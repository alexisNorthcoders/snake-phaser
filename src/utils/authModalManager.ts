import InputText from 'phaser3-rex-plugins/plugins/inputtext';
import { computeAuthModalLayout, type Box } from './authModalLayout';
import { migrateAnonymousScores } from './scoreMigrationHelper';

export interface AuthModalConfig {
  /** Form the overlay opens on. Back closes the overlay. */
  initialForm: 'login' | 'register';
  /** Replaces the form's default heading (e.g. "SAVE YOUR SCORE"). */
  title?: string;
  /** One-line hint shown under the heading. */
  subtitle?: string;
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
    this.currentConfig = config;
    this.isRegistering = config.initialForm === 'register';
    this.showAuthForm(config);
  }

  private showAuthForm(config?: AuthModalConfig) {
    const cfg = config || this.currentConfig;
    if (!cfg) return;

    const { onDismiss } = cfg;
    const scene = this.state.scene;

    // Clear the previous form (when toggling login/register)
    this.state.objects.forEach(obj => obj.destroy());
    this.state.objects = [];

    const layout = computeAuthModalLayout(scene.scale.width, scene.scale.height, !!cfg.subtitle);
    const { panel: panelBox } = layout;
    const label = (box: Box, text: string) => {
      const t = scene.add.text(box.x, box.y, text, { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setDepth(30);
      this.state.objects.push(t);
    };
    const input = (box: Box, type: string) => {
      const field = new InputText(scene, box.x, box.y, box.width, box.height, {
        backgroundColor: '#333',
        fontSize: '18px',
        color: '#fff',
        type,
      });
      scene.add.existing(field);
      field.setDepth(30);
      this.state.objects.push(field);
      return field;
    };

    const panel = scene.add.rectangle(panelBox.x, panelBox.y, panelBox.width, panelBox.height, 0x000000, 1)
      .setStrokeStyle(2, 0x00ff00)
      .setDepth(30);
    this.state.objects.push(panel);

    const title = scene.add.text(layout.title.x, layout.title.y, cfg.title ?? (this.isRegistering ? 'CREATE ACCOUNT' : 'LOGIN'), {
      fontSize: '24px',
      color: '#00ff00',
    })
      .setOrigin(0.5)
      .setDepth(30);
    this.state.objects.push(title);

    if (cfg.subtitle && layout.subtitle) {
      const subtitle = scene.add.text(layout.subtitle.x, layout.subtitle.y, cfg.subtitle, {
        fontSize: '14px',
        color: '#cccccc',
        wordWrap: { width: layout.textWidth },
        align: 'center',
      })
        .setOrigin(0.5)
        .setDepth(30);
      this.state.objects.push(subtitle);
    }

    label(layout.usernameLabel, 'Username');
    this.usernameText = input(layout.usernameInput, 'text');
    label(layout.passwordLabel, 'Password');
    this.passwordText = input(layout.passwordInput, 'password');

    this.errorText = scene.add.text(layout.error.x, layout.error.y, '', {
      fontSize: '14px',
      color: '#ff4444',
      wordWrap: { width: layout.textWidth },
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(30);
    this.state.objects.push(this.errorText);

    const submitButton = scene.add.text(layout.submit.x, layout.submit.y, this.isRegistering ? 'Register' : 'Login', {
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

    const toggleButton = scene.add.text(layout.toggle.x, layout.toggle.y, this.isRegistering ? 'Already have an account? Login' : 'Need an account? Register', {
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

    const backButton = scene.add.text(layout.back.x, layout.back.y, 'Back', {
      fontSize: '14px',
      color: '#cccccc',
    })
      .setOrigin(0.5)
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.close();
        onDismiss();
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
