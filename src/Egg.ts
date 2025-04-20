import { Container, Sprite, Texture } from 'pixi.js';
import { rectangularCollision } from './utils';
import { Player } from './Player';
import { GameState } from './GameState';
import { AUDIO } from './audio';

export interface IEggOptions {
  x: number;
  y: number;
  texture: Texture;
  onCollect?: (egg: Egg) => void;
}

export class Egg extends Container {
  private sprite: Sprite;
  private isCollected: boolean = false;
  private onCollect?: (egg: Egg) => void;
  
  constructor(options: IEggOptions) {
    super();
    
    this.x = options.x;
    this.y = options.y;
    this.onCollect = options.onCollect;
    
    // Create sprite with smaller size
    this.sprite = new Sprite(options.texture);
    this.sprite.width = 30;  // Make egg smaller
    this.sprite.height = 30; // Make egg smaller
    
    // Center the sprite's anchor point
    this.sprite.anchor.set(0.5, 0.5);
    
    this.addChild(this.sprite);
  }
  
  public checkCollision(player: Player): boolean {
    if (this.isCollected) return false;
    
    if (rectangularCollision({
      rect1: player,
      rect2: this
    })) {
      this.collect();
      return true;
    }
    
    return false;
  }
  
  private collect(): void {
    if (this.isCollected) return;
    
    this.isCollected = true;
    this.visible = false;
    
    // Play a sound - we'll use tackleHit as it's a good pickup sound
    AUDIO.tackleHit.play();
    
    // Call the onCollect callback if provided
    if (this.onCollect) {
      this.onCollect(this);
    }
  }
  
  public reset(): void {
    this.isCollected = false;
    this.visible = true;
  }
} 