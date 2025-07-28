import { GameScene } from './scenes/GameScene';
import { Snake } from './Snake';
import { Food } from './Food';
import { drawBackground, updateFood } from './utils';
import socketManager from './SocketManager';

export function handleSocketMessage(scene: GameScene, msg: MessageEvent) {
  let parsed;
  try {
    parsed = JSON.parse(msg.data);
  } catch (e) {
    console.warn('[GameScene] Non-JSON message received:', msg.data);
    return;
  }

  switch (parsed.event) {
    case 'verified':
      console.log('Verified connection. Server is ready.');
      if (!scene.gameConfigured && !scene.isGameOver) {
        socketManager.send({
          event: 'newPlayer',
          player: {
            name: scene.name,
            id: scene.playerId,
            colours: scene.snakeColors,
          }
        });
        scene.playerNameText.setText(`Player: ${scene.name}`);
      }
      break;

    case 'config':
      console.log(parsed)
      if (!scene.gameConfigured) {
        scene.gameConfigured = true;
        drawBackground(scene, parsed.config.backgroundNumber)
        parsed.food.forEach((food: any) => {
          const newFood = new Food(scene, { x: food[0], y: food[1] }, food[2], food[3]);
          scene.food.push(newFood);
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
        scene.snakes.set(player.id, newSnake);
      });
      break;

    case 'updateFood': {
      const [x, y, id, type] = parsed.food[0];
      updateFood(x, y, id, type, scene.food);
      break;
    }

    default:
      console.log('[GameScene] Unhandled event:', parsed.event);
  }
};