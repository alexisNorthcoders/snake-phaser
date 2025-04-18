import { GameScene } from './scenes/GameScene';
import { Snake } from './Snake';
import { Food } from './Food';
import { updateFood } from './utils';
import socketManager from './SocketManager';

export function handleSocketMessage(scene: GameScene, msg: MessageEvent) {
  const data = msg.data;

  if (data === 'p') {
    const latency = Date.now() - scene['startTime'];
    scene['pingText'].setText(`Ping: ${latency}ms`);
    setTimeout(() => measurePing(scene), 5000);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    console.warn('[GameScene] Non-JSON message received:', data);
    return;
  }

  switch (parsed.event) {
    case 'verified':
      console.log('Verified connection. Server is ready.');
      if (!scene['gameStarted'] && !scene['isGameOver']) {
        socketManager.send({
          event: 'newPlayer',
          player: {
            name: scene['name'],
            id: scene['playerId'],
            colours: scene['snakeColors'],
          }
        });
        scene['playerNameText'].setText(`Player: ${scene['name']}`);
        measurePing(scene);
      }
      break;

    case 'config':
      if (!scene['gameConfigured']) {
        scene['gameConfigured'] = true;
        parsed.food.forEach((food: any) => {
          const newFood = new Food(scene, { x: food[0], y: food[1] }, food[2], food[3]);
          scene['food'].push(newFood);
        });
      }
      break;

    case 'waitingRoomStatus':
      parsed.players.forEach((player: any) => {
        const snakeData = player.snake;
        const newSnake = new Snake(scene, snakeData.x, snakeData.y, player.type, player.colours, snakeData.size);
        newSnake.tail = snakeData.tail;
        newSnake.speed = snakeData.speed;
        newSnake.isDead = snakeData.isDead;
        newSnake.food = snakeData.score ?? 0;
        scene['snakes'].set(player.id, newSnake);
      });
      break;

    case 'snake_update_v2':
      for (const snakeUpdate of parsed.snakes) {
        const currentSnake = scene['snakes'].get(snakeUpdate.playerId);
        if (!currentSnake) continue;

        if (snakeUpdate.playerId === scene['playerId']) {
          scene['scoreText'].setText(`Score: ${snakeUpdate.score}`);
        }

        if (currentSnake.isDead) continue;

        currentSnake.tail = snakeUpdate.tail;
        currentSnake.food = snakeUpdate.score;
        currentSnake.position({ x: snakeUpdate.x, y: snakeUpdate.y });

        if (snakeUpdate.isDead) {
          currentSnake.stop(snakeUpdate.playerId, snakeUpdate.score, false, async () => { });
        }
      }
      break;

    case 'updateFood': {
      const [x, y, id, type] = parsed.food[0];
      updateFood(x, y, id, type, scene['food']);
      break;
    }

    default:
      console.log('[GameScene] Unhandled event:', parsed.event);
  }
};


function measurePing(scene: GameScene) {
  if (scene['isGameOver']) return;

  scene['startTime'] = Date.now();
  socketManager.send('p');
}