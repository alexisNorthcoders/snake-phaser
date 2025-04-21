import { getHighScores } from "../Snake";

export class LoginScene extends Phaser.Scene {
    private usernameInput!: HTMLInputElement;
    private passwordInput!: HTMLInputElement;
    private errorText!: Phaser.GameObjects.Text;
    private submitButton!: Phaser.GameObjects.Text;
    private toggleModeButton!: Phaser.GameObjects.Text;
    private isRegistering: boolean = false;

    constructor() {
        super('LoginScene');
    }

    create() {

        getHighScores()

        const userData = localStorage.getItem('userData');

        if (userData) {
            const parsedUserData = JSON.parse(userData);

            this.verifyToken(parsedUserData.token)
                .then((isValid) => {
                    if (isValid) {

                        this.startGame();
                    } else {

                        localStorage.removeItem('userData');
                        this.showLoginScreen();
                    }
                })
                .catch(() => {

                    localStorage.removeItem('userData');
                    this.showLoginScreen();
                });
        } else {

            this.showLoginScreen();
        }
    }

    createLoginUI() {

        // Display Title
        this.add.text(400, 50, 'Snake Game', {
            fontSize: '32px',
            color: '#fff',
        }).setOrigin(0.5);

        this.add.text(100, 150, 'Username:', { fontSize: '24px', color: '#fff' });
        this.add.text(100, 300, 'Password:', { fontSize: '24px', color: '#fff' });

        // Create login UI elements (inputs, buttons, etc.)
        this.usernameInput = document.createElement('input');
        this.usernameInput.type = 'text';
        this.usernameInput.style.position = 'absolute';
        this.usernameInput.style.left = '500px';
        this.usernameInput.style.top = '174px';
        this.usernameInput.style.fontSize = '24px';
        this.usernameInput.style.padding = '5px';
        this.usernameInput.style.backgroundColor = '#333';
        this.usernameInput.style.color = 'white';
        this.usernameInput.style.border = 'none';
        this.usernameInput.style.outline = 'none';
        document.body.appendChild(this.usernameInput);

        // HTML Input for Password
        this.passwordInput = document.createElement('input');
        this.passwordInput.type = 'password';
        this.passwordInput.style.position = 'absolute';
        this.passwordInput.style.left = '500px';
        this.passwordInput.style.top = '324px';
        this.passwordInput.style.fontSize = '24px';
        this.passwordInput.style.padding = '5px';
        this.passwordInput.style.backgroundColor = '#333';
        this.passwordInput.style.color = 'white';
        this.passwordInput.style.border = 'none';
        this.passwordInput.style.outline = 'none';
        document.body.appendChild(this.passwordInput);

        // Load the last used username from userData (if exists)
        const userData = localStorage.getItem('userData');
        if (userData) {
            const parsedUserData = JSON.parse(userData);
            this.usernameInput.value = parsedUserData.username;
        }

        // Error Text (Initially Hidden)
        this.errorText = this.add.text(400, 420, '', {
            fontSize: '18px',
            color: 'red',
        }).setOrigin(0.5);

        // Submit Button
        this.submitButton = this.add.text(400, 470, 'Login', {
            fontSize: '20px',
            color: '#00ff00',
            backgroundColor: '#222',
            padding: { x: 10, y: 5 },
        }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.submit());

        // Toggle between Login/Register modes
        this.toggleModeButton = this.add.text(400, 520, 'Need an account? Register', {
            fontSize: '16px',
            color: '#00ffff',
        }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggleMode());

        // Create guest button
        const guestButton = this.add.text(400, 570, 'Play as Guest', {
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#555',
            padding: { x: 10, y: 5 },
        }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.anonymous());

        // Focus on the username input when the scene starts
        this.usernameInput.focus();

        // Close keyboard when user clicks outside input
        window.addEventListener('click', (e) => {
            if (e.target !== this.usernameInput && e.target !== this.passwordInput) {
                this.usernameInput.blur();
                this.passwordInput.blur();
            }
        });
    }

    showLoginScreen() {
        // Remove the input elements if they're still in the DOM
        if (this.usernameInput && this.passwordInput) {
            document.body.removeChild(this.usernameInput);
            document.body.removeChild(this.passwordInput);
        }

        // Recreate the inputs and render the login screen (as before)
        this.createLoginUI();
    }

    toggleMode() {
        this.isRegistering = !this.isRegistering;
        this.submitButton.setText(this.isRegistering ? 'Register' : 'Login');
        this.toggleModeButton.setText(
            this.isRegistering ? 'Already have an account? Login' : 'Need an account? Register'
        );
        this.errorText.setText('');
    }

    async submit() {
        const username = this.usernameInput.value;
        const password = this.passwordInput.value;

        if (!username || !password) {
            this.errorText.setText('Both fields are required.');
            return;
        }

        this.errorText.setText('');

        if (this.isRegistering) {
            await this.register(username, password);
        } else {
            await this.login(username, password);
        }
    }

    async login(username: string, password: string) {
        const res = await fetch(`${this.getAPIUrl()}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('userData', JSON.stringify({
                token: data.accessToken,
                username: username,
                userId: data.userId,
            }));
            this.startGame();
        } else {
            this.errorText.setText('Login failed. Please check credentials.');
        }
    }

    async register(username: string, password: string) {
        const res = await fetch(`${this.getAPIUrl()}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (res.ok) {
            this.login(username, password);
        } else {
            this.errorText.setText('Registration failed. User may exist.');
        }
    }

    async anonymous() {
        const res = await fetch(`${this.getAPIUrl()}/anonymous`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('userData', JSON.stringify({
                token: data.accessToken,
                username: `anonymous`,
                userId: data.userId,
            }));
            this.startGame();
        } else {
            this.errorText.setText('Guest login failed.');
        }
    }

    async verifyToken(token: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.getAPIUrl()}/verify-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();

                if (data.message === "Token is valid") {
                    console.log(data)

                    const userData = {
                        token,
                        username: data.user.username,
                        userId: data.userId,
                        expiresIn: data.expiresIn,
                    };

                    localStorage.setItem('userData', JSON.stringify(userData));

                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } catch (error) {
            console.error('Error verifying token:', error);
            return false;
        }
    }
    getAPIUrl() {
        return '/api';
    }

    startGame() {
        if (this.usernameInput && this.passwordInput) {
            document.body.removeChild(this.usernameInput);
            document.body.removeChild(this.passwordInput);
        }
        this.scene.start('GameScene');
    }
}
