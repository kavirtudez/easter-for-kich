import { AnimatedSprite, Container, type Texture } from 'pixi.js';
import { type DeepPartial, type IPosition } from './classes';
import { logPlayerImpulse } from './logger';
import { Player } from './Player';

export interface INPCOptions {
  position: IPosition;
  sprites: {
    up: Texture[];
    left: Texture[];
    right: Texture[];
    down: Texture[];
  };
  name: string;
}

enum NPCDirection {
  up,
  down,
  left,
  right
}

interface IImpulse {
  up: number;
  left: number;
  right: number;
  down: number;
}

export class NPC extends Container {
  public DIRECTIONS = NPCDirection;
  private _direction!: NPCDirection;
  public animationSpeed = 0.1;
  public up!: AnimatedSprite;
  public left!: AnimatedSprite;
  public right!: AnimatedSprite;
  public down!: AnimatedSprite;
  public velocity = 2; // Slightly slower than player
  public name: string;
  public targetReached: boolean = false;
  public hasInteracted: boolean = false;

  private readonly impulse: IImpulse = {
    up: 0,
    left: 0,
    right: 0,
    down: 0
  };

  constructor(options: INPCOptions) {
    super();
    this.name = options.name;
    this.setup(options);
    this.setDirection(NPCDirection.down);
    this.x = options.position.x;
    this.y = options.position.y;
  }

  hideAllDirections(): void {
    [this.up, this.left, this.right, this.down].forEach(spr => {
      spr.visible = false;
    });
  }

  setDirection(dir: NPCDirection): void {
    this.hideAllDirections();
    switch (dir) {
      case NPCDirection.down:
        this.down.visible = true;
        break;
      case NPCDirection.left:
        this.left.visible = true;
        break;
      case NPCDirection.right:
        this.right.visible = true;
        break;
      case NPCDirection.up:
        this.up.visible = true;
        break;
    }
    this._direction = dir;
  }

  stopAllAnimations(): void {
    [this.up, this.left, this.right, this.down].forEach(spr => {
      spr.stop();
    });
  }

  playAnimation(): void {
    this.stopAllAnimations();
    switch (this._direction) {
      case NPCDirection.down:
        this.down.play();
        break;
      case NPCDirection.left:
        this.left.play();
        break;
      case NPCDirection.right:
        this.right.play();
        break;
      case NPCDirection.up:
        this.up.play();
        break;
    }
  }

  setup({ sprites: { up, left, right, down } }: INPCOptions): void {
    const upSpr = new AnimatedSprite(up);
    upSpr.animationSpeed = this.animationSpeed;
    this.addChild(upSpr);
    this.up = upSpr;

    const leftSpr = new AnimatedSprite(left);
    leftSpr.animationSpeed = this.animationSpeed;
    this.addChild(leftSpr);
    this.left = leftSpr;

    const righSpr = new AnimatedSprite(right);
    righSpr.animationSpeed = this.animationSpeed;
    this.addChild(righSpr);
    this.right = righSpr;

    const downSpr = new AnimatedSprite(down);
    downSpr.animationSpeed = this.animationSpeed;
    this.addChild(downSpr);
    this.down = downSpr;
  }

  setImpulse(impulse: DeepPartial<IImpulse>): void {
    Object.assign(this.impulse, impulse);
    if (typeof impulse.up === 'number' && impulse.up > 0 && this.impulse.down > 0) {
      this.impulse.down = 0;
    } else if (typeof impulse.left === 'number' && impulse.left > 0 && this.impulse.right > 0) {
      this.impulse.right = 0;
    } else if (typeof impulse.right === 'number' && impulse.right > 0 && this.impulse.left > 0) {
      this.impulse.left = 0;
    } else if (typeof impulse.down === 'number' && impulse.down > 0 && this.impulse.up > 0) {
      this.impulse.up = 0;
    }
    
    if (this.impulse.left > 0) {
      this.setDirection(NPCDirection.left);
    } else if (this.impulse.right > 0) {
      this.setDirection(NPCDirection.right);
    } else if (this.impulse.up > 0) {
      this.setDirection(NPCDirection.up);
    } else if (this.impulse.down > 0) {
      this.setDirection(NPCDirection.down);
    }
    
    if (this.impulse.left > 0 || this.impulse.right > 0 || this.impulse.up > 0 || this.impulse.down > 0) {
      this.playAnimation();
    } else {
      this.stopAllAnimations();
    }
  }

  moveTowardsTarget(target: Player, boundaries: any[]): void {
    if (this.targetReached) return;
    
    // Calculate distance to target
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If we're close enough, stop and mark target as reached
    if (distance < 100) { // NPC will stop 100 pixels away from player
      this.releaseAllImpulse();
      this.targetReached = true;
      return;
    }
    
    // Determine direction to move
    const impulse: DeepPartial<IImpulse> = {
      up: 0,
      down: 0,
      left: 0,
      right: 0
    };
    
    // Prioritize horizontal or vertical movement based on distance
    if (Math.abs(dx) > Math.abs(dy)) {
      // Move horizontally first
      if (dx > 0) {
        impulse.right = 1;
      } else {
        impulse.left = 1;
      }
    } else {
      // Move vertically first
      if (dy > 0) {
        impulse.down = 1;
      } else {
        impulse.up = 1;
      }
    }
    
    this.setImpulse(impulse);
  }

  releaseAllImpulse(): void {
    this.setImpulse({ up: 0, left: 0, right: 0, down: 0 });
  }

  getVerticalImpulse(): number {
    return this.impulse.up > 0 ? -this.velocity * this.impulse.up : this.impulse.down > 0 ? this.velocity * this.impulse.down : 0;
  }

  getHorizontalImpulse(): number {
    return this.impulse.left > 0 ? -this.velocity * this.impulse.left : this.impulse.right > 0 ? this.velocity * this.impulse.right : 0;
  }
} 