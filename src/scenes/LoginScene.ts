import Phaser from 'phaser';
import { getHighScores } from '../Snake';

export class LoginScene extends Phaser.Scene {
    private username: string = '';
    private password: string = '';
    private usernameText!: Phaser.GameObjects.Text;
    private passwordText!: Phaser.GameObjects.Text;
    private errorText!: Phaser.GameObjects.Text;
    private activeField: 'username' | 'password' = 'username';

    constructor() {
        super('LoginScene');
    }

    create() {
        getHighScores()
        // Display Title
        this.add.text(400, 50, 'Login to Play', {
            fontSize: '32px',
            color: '#fff',
        }).setOrigin(0.5);

        // Username Prompt
        this.add.text(100, 150, 'Username:', { fontSize: '24px', color: '#fff' });

        // Username Input
        this.usernameText = this.add.text(100, 200, '', {
            fontSize: '24px',
            color: '#fff',
            backgroundColor: '#333',
        });

        // Password Prompt
        this.add.text(100, 300, 'Password:', { fontSize: '24px', color: '#fff' });

        // Password Input (Initially Hidden, will be masked by `*`)
        this.passwordText = this.add.text(100, 350, '', {
            fontSize: '24px',
            color: '#fff',
            backgroundColor: '#333',
        });

        // Error Text (Initially Hidden)
        this.errorText = this.add.text(400, 450, '', {
            fontSize: '18px',
            color: 'red',
        }).setOrigin(0.5);

        const anonLoginButton = this.add.text(400, 500, 'Login as Guest', {
            fontSize: '20px',
            color: '#00ff00',
            backgroundColor: '#222',
            padding: { x: 10, y: 5 },
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => anonLoginButton.setStyle({ backgroundColor: '#444' }))
            .on('pointerout', () => anonLoginButton.setStyle({ backgroundColor: '#222' }))
            .on('pointerdown', () => {
                this.anonymous();
            });

        // Event listeners for key input
        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.handleInput(event));
    }

    handleInput(event: KeyboardEvent) {
        const key = event.key;

        // Handle non-printable keys (like shift, ctrl, etc.)
        if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'CapsLock') {
            return; // Ignore these keys
        }

        // Handle backspace
        if (key === 'Backspace') {
            if (this.activeField === 'username' && this.usernameText.text.length > 0) {
                this.usernameText.setText(this.usernameText.text.slice(0, -1));
                this.username = this.username.slice(0, -1);
            } else if (this.activeField === 'password' && this.passwordText.text.length > 0) {
                this.passwordText.setText('*'.repeat(this.passwordText.text.length - 1));
                this.password = this.password.slice(0, -1);
            }
        }

        // Handle Enter key
        else if (key === 'Enter') {
            if (this.activeField === 'username' && this.username) {
                // Move to password input when username is filled
                this.activeField = 'password';
                this.passwordText.setText(''); // Reset password field
            } else if (this.activeField === 'password' && this.username && this.password) {
                this.login(this.username, this.password); // Call login function
            } else {
                this.errorText.setText('Please enter both username and password.');
            }
        }

        // Handle username and password typing
        else if (this.activeField === 'username' && this.username.length < 20) {

            if (/^[A-Za-z0-9_]*$/.test(key)) {
                this.username += key;
                this.usernameText.setText(this.username);
            }
        } else if (this.activeField === 'password' && this.password.length < 20) {

            if (/^[A-Za-z0-9]*$/.test(key)) {
                this.password += key;
                this.passwordText.setText('*'.repeat(this.password.length));
            }
        }
    }

    async login(username: string, password: string) {
        const response = await fetch(`${this.getAPIUrl()}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            const data = await response.json();
            const userData = {
                token: data.accessToken,
                username: username,
                userId: data.userId,
            };

            localStorage.setItem('userData', JSON.stringify(userData));
            this.startGame();
        } else {
            this.errorText.setText('Invalid credentials');
        }
    }

    async anonymous() {
        const response = await fetch(`${this.getAPIUrl()}/anonymous`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
            const data = await response.json();
            const userData = {
                token: data.accessToken,
                username: `anon-${data.userId}`,
                userId: data.userId,
            };

            localStorage.setItem('userData', JSON.stringify(userData));
            this.startGame();
        } else {
            this.errorText.setText('Failed to login anonymously');
        }
    }

    async register(username: string, password: string) {
        const response = await fetch(`${this.getAPIUrl()}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            this.login(username, password);
        } else {
            this.errorText.setText('Failed to register. User may already exist.');
        }
    }

    async logout() {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');

        await fetch(`${this.getAPIUrl()}/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userData.token}`,
            },
            body: JSON.stringify({ username: userData.username }),
        });

        localStorage.removeItem('userData');
        this.scene.start('LoginScene'); // Reload login scene after logout
    }

    // Helper method to get the API URL
    getAPIUrl() {
        return '/api'
    }

    startGame() {

        this.errorText.setText('');
        this.scene.start('GameScene');
    }

}
