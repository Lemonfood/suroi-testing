import Phaser from "phaser";

import core from "../core";
import { type Game } from "../game";
import { type MenuScene } from "./menuScene";
import { InputPacket } from "../packets/sending/inputPacket";
import { Player } from "../objects/player";
import gsap from "gsap";
import Vector2 = Phaser.Math.Vector2;
import { Obstacles } from "../../../../common/src/definitions/obstacles";
import { JoinPacket } from "../packets/sending/joinPacket";

export class GameScene extends Phaser.Scene {
    activeGame: Game;
    sounds: Map<string, Phaser.Sound.BaseSound> = new Map<string, Phaser.Sound.BaseSound>();

    constructor() {
        super("game");
    }

    preload(): void {
        if (core.game === undefined) return;
        this.activeGame = core.game;

        for (const object of Obstacles.definitions) {
            if (object.variations === undefined) {
                this.loadImage(`${object.idString}`, `${object.idString}.svg`);
            } else {
                for (let i = 1; i <= object.variations; i++) {
                    this.loadImage(`${object.idString}_${i}`, `${object.idString}_${i}.svg`);
                }
            }
            //this.load.svg(`${object.idString}_residue`, require(`../../assets/img/game/${object.idString}_residue.svg`));
            this.loadSound(`${object.idString}_destroyed`, `sfx/${object.idString}_destroyed.mp3`);
        }

        this.load.audio("swing", require("../../assets/audio/sfx/swing.mp3"));
        this.load.audio("grass_step_01", require("../../assets/audio/sfx/footsteps/grass_01.mp3"));
        this.load.audio("grass_step_02", require("../../assets/audio/sfx/footsteps/grass_02.mp3"));

        this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            if (this.player === undefined) return;
            this.player.rotation = Math.atan2(pointer.worldY - this.player.container.y, pointer.worldX - this.player.container.x);
            this.player.inputsDirty = true;
        });

        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (pointer.leftButtonDown() && !this.player.punching) {
                this.player.punching = true;
                const altFist: boolean = Math.random() < 0.5;
                gsap.to(altFist ? this.player.leftFist : this.player.rightFist, {
                    x: 75,
                    y: altFist ? 10 : -10,
                    duration: 0.11,
                    repeat: 1,
                    yoyo: true,
                    ease: "none",
                    onComplete: () => { this.player.punching = false; }
                });
                this.sound.add("swing").play();
            }
        });

        this.addKey("W", "movingUp");
        this.addKey("S", "movingDown");
        this.addKey("A", "movingLeft");
        this.addKey("D", "movingRight");

        this.cameras.main.setZoom(this.sys.game.canvas.width / 2560);
    }

    private loadImage(name: string, path: string): void {
        this.load.svg(name, require(`../../assets/img/game/${path}`));
    }

    private loadSound(name: string, path: string): void {
        this.load.audio(name, require(`../../assets/audio/${path}.mp3`));
    }

    private addKey(keyString: string, valueToToggle: string): void {
        const key: Phaser.Input.Keyboard.Key | undefined = this.input.keyboard?.addKey(keyString);
        if (key !== undefined) {
            key.on("down", () => {
                this.player[valueToToggle] = true;
                this.player.inputsDirty = true;
            });

            key.on("up", () => {
                this.player[valueToToggle] = false;
                this.player.inputsDirty = true;
            });
        }
    }

    get player(): Player {
        return this.activeGame.activePlayer;
    }

    create(): void {
        (this.scene.get("menu") as MenuScene).stopMusic();

        $("#game-ui").show();

        // Draw the grid
        const GRID_WIDTH = 7200;
        const GRID_HEIGHT = 7200;
        const CELL_SIZE = 160;

        for (let x = 0; x <= GRID_WIDTH; x += CELL_SIZE) {
            this.add.line(x, 0, x, 0, x, GRID_HEIGHT * 2, 0x000000, 0.25).setOrigin(0, 0);
        }
        for (let y = 0; y <= GRID_HEIGHT; y += CELL_SIZE) {
            this.add.line(0, y, 0, y, GRID_WIDTH * 2, y, 0x000000, 0.25).setOrigin(0, 0);
        }

        // Create the player
        this.activeGame.activePlayer = new Player(this.activeGame, this, "Player", this.activeGame.socket, new Vector2(0, 0));

        // Follow the player w/ the camera
        this.cameras.main.startFollow(this.player.container);

        // Start the tick loop
        this.tick();

        // Send a packet indicating that the game is now active
        this.activeGame.sendPacket(new JoinPacket(this.player));
    }

    playSound(name: string): void {
        const sound: Phaser.Sound.BaseSound | undefined = this.sounds.get(name);
        if (sound === undefined) {
            console.warn(`Unknown sound: "${name}"`);
            return;
        }
        sound.play();
    }

    tick(): void {
        if (this.player?.inputsDirty) {
            this.player.inputsDirty = false;
            this.activeGame.sendPacket(new InputPacket(this.player));
        }

        setTimeout(() => { this.tick(); }, 30);
    }
}
