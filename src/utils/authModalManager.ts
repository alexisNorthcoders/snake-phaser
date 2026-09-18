import InputText from 'phaser3-rex-plugins/plugins/inputtext';
import { migrateAnonymousScores } from './scoreMigrationHelper';

export interface AuthModalConfig {
  playerName: string;
  playerScore: number;
  onAuthSuccess: () => void;
  onDismiss: () => void;
}

interface AuthModalState {
  isOpen: boolean;
  objects: Phaser.GameObjects.GameObject[];
  scene: Phaser.Scene;
}

class AuthModalManager {
  private state: AuthModalState = {
    isOpen: false,
    objects: [],
    scene: null as any,
  };

  private isRegistering = false;
  private usernameText: InputText | null = null;
  private passwordText: InputText | null = null;
  private errorText: Phaser.GameObjects.Text | null = null;
  private currentConfig: AuthModalConfig | null = null;

  open(scene: Phaser.Scene, config: AuthModalConfig) {
    if (this.state.isOpen) return;

    this.state.isOpen = true;
    this.state.scene = scene;
    this.state.objects = [];
    this.isRegistering = false;
    this.currentConfig = config;

    this.createInitialPrompt(config);
  }

  private createInitialPrompt(config: AuthModalConfig) {
    const { playerName, playerScore, onAuthSuccess, onDismiss } = config;
    const scene = this.state.scene;

    const PANEL_CENTER_X = 400;
    const PANEL_WIDTH = 360;
    const PANEL_TOP_Y = 180;
    const PANEL_BOTTOM_Y = 520;
    const panelCenterY = (PANEL_TOP_Y + PANEL_BOTTOM_Y) / 2;

    const panel = scene.add.rectangle(PANEL_CENTER_X, panelCenterY, PANEL_WIDTH, PANEL_BOTTOM_Y - PANEL_TOP_Y, 0x000000, 0.9)
      .setOrigin(0.5)
      .setDepth(30);
    this.state.objects.push(panel);

    const title = scene.add.text(PANEL_CENTER_X, 200, 'SAVE THIS SCORE FOREVER?', {
      fontSize: '22px',
      color: '#ffff00',
      wordWrap: { width: 320, useAdvancedWrap: true },
    })
      .setOrigin(0.5)
      .setDepth(30);
    this.state.objects.push(title);

    const scoreText = scene.add.text(PANEL_CENTER_X, 260, `Your Score: ${playerScore}`, {
      fontSize: '28px',
      color: '#00ff00',
    })
      .setOrigin(0.5)
      .setDepth(30);
    this.state.objects.push(scoreText);

    const playerNameText = scene.add.text(PANEL_CENTER_X, 310, `Player: ${playerName}`, {
      fontSize: '18px',
      color: '#cccccc',
    })
      .setOrigin(0.5)
      .setDepth(30);
    this.state.objects.push(playerNameText);

    const guestButton = scene.add.text(PANEL_CENTER_X, 435, 'Play as Guest', {
      fontSize: '18px',
      backgroundColor: '#555',
      color: '#ffffff',
      padding: { x: 10, y: 5 },
      fixedWidth: 260,
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => guestButton.setStyle({ backgroundColor: '#777' }))
      .on('pointerout', () => guestButton.setStyle({ backgroundColor: '#555' }))
      .on('pointerdown', () => {
        this.close();
        onDismiss();
      });
    this.state.objects.push(guestButton);

    const authButton = scene.add.text(PANEL_CENTER_X, 380, 'Create Account / Log In', {
      fontSize: '18px',
      backgroundColor: '#00aa00',
      color: '#ffffff',
      padding: { x: 10, y: 5 },
      fixedWidth: 260,
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => authButton.setStyle({ backgroundColor: '#00cc00' }))
      .on('pointerout', () => authButton.setStyle({ backgroundColor: '#00aa00' }))
      .on('pointerdown', () => {
        this.showAuthForm(config);
      });
    this.state.objects.push(authButton);
  }

  private showAuthForm(config?: AuthModalConfig) {
    const cfg = config || this.currentConfig;
    if (!cfg) return;

    const { onAuthSuccess, onDismiss } = cfg;
    const scene = this.state.scene;

    // Clear initial prompt
    this.state.objects.forEach(obj => obj.destroy());
    this.state.objects = [];

    const PANEL_CENTER_X = 400;
    const PANEL_WIDTH = 360;
    const PANEL_TOP_Y = 150;
    const PANEL_BOTTOM_Y = 550;
    const panelCenterY = (PANEL_TOP_Y + PANEL_BOTTOM_Y) / 2;

    const panel = scene.add.rectangle(PANEL_CENTER_X, panelCenterY, PANEL_WIDTH, PANEL_BOTTOM_Y - PANEL_TOP_Y, 0x000000, 0.9)
      .setOrigin(0.5)
      .setDepth(30);
    this.state.objects.push(panel);

    const title = scene.add.text(PANEL_CENTER_X, 170, this.isRegistering ? 'CREATE ACCOUNT' : 'LOGIN', {
      fontSize: '24px',
      color: '#00ff00',
    })
      .setOrigin(0.5)
      .setDepth(30);
    this.state.objects.push(title);

    scene.add.text(100, 220, 'Username:', { fontSize: '18px', color: '#fff' }).setDepth(30);
    this.state.objects.push(scene.children.list[scene.children.list.length - 1]);

    this.usernameText = new InputText(scene, 260, 230, 180, 35, {
      backgroundColor: '#333',
      fontSize: '18px',
      color: '#fff',
      type: 'text',
    });
    scene.add.existing(this.usernameText);
    this.usernameText.setDepth(30);
    this.state.objects.push(this.usernameText);

    scene.add.text(100, 280, 'Password:', { fontSize: '18px', color: '#fff' }).setDepth(30);
    this.state.objects.push(scene.children.list[scene.children.list.length - 1]);

    this.passwordText = new InputText(scene, 260, 290, 180, 35, {
      backgroundColor: '#333',
      fontSize: '18px',
      color: '#fff',
      type: 'password',
    });
    scene.add.existing(this.passwordText);
    this.passwordText.setDepth(30);
    this.state.objects.push(this.passwordText);

    this.errorText = scene.add.text(PANEL_CENTER_X, 340, '', {
      fontSize: '14px',
      color: '#ff4444',
      wordWrap: { width: 320 },
    })
      .setOrigin(0.5)
      .setDepth(30);
    this.state.objects.push(this.errorText);

    const submitButton = scene.add.text(PANEL_CENTER_X, 400, this.isRegistering ? 'Register' : 'Login', {
      fontSize: '18px',
      backgroundColor: '#00aa00',
      color: '#ffffff',
      padding: { x: 15, y: 5 },
    })
      .setOrigin(0.5)
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => submitButton.setStyle({ backgroundColor: '#00cc00' }))
      .on('pointerout', () => submitButton.setStyle({ backgroundColor: '#00aa00' }))
      .on('pointerdown', () => {
        this.handleSubmit(cfg);
      });
    this.state.objects.push(submitButton);

    const toggleButton = scene.add.text(PANEL_CENTER_X, 450, this.isRegistering ? 'Already have an account? Login' : 'Need an account? Register', {
      fontSize: '14px',
      color: '#00ffff',
    })
      .setOrigin(0.5)
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.isRegistering = !this.isRegistering;
        this.showAuthForm(cfg);
      });
    this.state.objects.push(toggleButton);

    const backButton = scene.add.text(PANEL_CENTER_X, 490, 'Back', {
      fontSize: '14px',
      color: '#cccccc',
    })
      .setOrigin(0.5)
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.isRegistering = false;
        this.close();
        this.open(scene, cfg);
      });
    this.state.objects.push(backButton);

    if (this.usernameText) {
      this.usernameText.setFocus();
    }
  }

  private async handleSubmit(config: AuthModalConfig) {
    if (!this.usernameText || !this.passwordText || !this.errorText) return;

    const username = this.usernameText.text;
    const password = this.passwordText.text;

    if (!username || !password) {
      this.errorText.setText('Both fields are required.');
      return;
    }

    try {
      if (this.isRegistering) {
        await this.register(username, password);
      } else {
        await this.login(username, password, config);
      }
    } catch (error) {
      this.errorText.setText('An error occurred. Please try again.');
      console.error('Auth error:', error);
    }
  }

  private async register(username: string, password: string) {
    if (!this.errorText || !this.currentConfig) return;

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      this.errorText.setText('Account created! Logging in...');
      // After successful registration, log in with the credentials
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.isRegistering = false;
      await this.login(username, password, this.currentConfig);
    } else {
      this.errorText.setText('Registration failed. User may exist.');
    }
  }

  private async login(username: string, password: string, config: AuthModalConfig) {
    if (!this.errorText) return;

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      const token = data.accessToken;
      const userId = data.userId;

      localStorage.setItem('userData', JSON.stringify({
        token,
        username: username,
        userId,
        isGuest: false,
      }));

      // Migrate anonymous scores if any exist
      const migrationMessage = await migrateAnonymousScores(token, userId);

      // Show success message and wait before closing
      this.errorText.setStyle({ color: '#00ff00' });
      this.errorText.setText(migrationMessage || 'Login successful!');

      // Wait 2 seconds for user to see confirmation, then close
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.close();
      config.onAuthSuccess();
    } else {
      this.errorText.setText('Login failed. Check your credentials.');
    }
  }

  close() {
    if (!this.state.isOpen) return;

    this.state.objects.forEach(obj => obj.destroy());
    this.state.objects = [];
    this.usernameText = null;
    this.passwordText = null;
    this.errorText = null;
    this.currentConfig = null;
    this.state.isOpen = false;
  }

  isModalOpen(): boolean {
    return this.state.isOpen;
  }
}

export const authModalManager = new AuthModalManager();
