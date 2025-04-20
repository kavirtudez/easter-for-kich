import { Container, Sprite, type Texture, Graphics, Text, TextStyle } from 'pixi.js'
import { AUDIO } from './audio'
import { Boundary } from './Boundary'
import { type IScreen } from './classes'
import { type TTileLayer } from './GameLoader'
import { logKeydown, logKeyup, logPlayerCollision } from './logger'
import { MoveInterface } from './MoveInterface'
import { Player, type IPlayerOptions } from './Player'
import { rectangularCollision } from './utils'
import { GameState } from './GameState'
import { DialogueBox } from './DialogueBox'
import { Egg } from './Egg'
import { NPC } from './NPC'

interface IMapScreenOptions {
  viewWidth: number
  viewHeight: number
  collisionsLayer: TTileLayer
  battleZonesLayer: TTileLayer
  playerSprites: IPlayerOptions['sprites']
  mapSprites: {
    background: Texture
    foreground: Texture
  }
  onBattleStart: () => void
  eggTexture: Texture
  lilyTexture?: Texture
  gameLoader?: any
}

export class MapScreen extends Container implements IScreen {
  public cellWidth = 48
  public cellHeight = 48
  public isActive = false
  public tilesPerRow = 70
  public playerMoveInitialized = false

  public player!: Player
  public boundaries: Boundary[] = []
  public battleZones: Boundary[] = []
  public background!: Sprite
  public foreground!: Sprite
  public moveInterface!: MoveInterface
  public overlappingBattleTrigger = 0.5
  public overlappingBattleChance = 0.05
  public onBattleStart!: IMapScreenOptions['onBattleStart']
  public dialogueBox!: DialogueBox
  public showingIntro: boolean = true
  public eggs: Egg[] = []
  public anda: NPC | null = null
  public lily: Sprite | null = null
  public overlay: Graphics | null = null
  public retryButton: Container | null = null
  public isGameEnding: boolean = false
  public dialogueQueue: string[] = []
  public gameLoader: any
  private _andaCreationStarted: boolean = false

  constructor (options: IMapScreenOptions) {
    super()
    this.onBattleStart = options.onBattleStart
    this.gameLoader = options.gameLoader
    
    // Enable sortableChildren to respect zIndex values
    this.sortableChildren = true;
    
    this.setup(options)
  }

  setup (options: IMapScreenOptions): void {
    this.setupBackground(options)
    this.setupLayers(options)
    this.setupEggs(options)
    this.setupPlayer(options)
    this.setupForeground(options)
    this.setupMoveInterface(options)
    this.setupDialogueBox(options)
  }

  setupEggs({ eggTexture }: IMapScreenOptions): void {
    // We need to place eggs only in battle zones (grass areas)
    // First, we'll wait until battle zones are set up by utilizing the existing battle zones
    
    // If we don't have battle zones yet, return
    if (!this.battleZones || this.battleZones.length === 0) {
      console.warn('Battle zones not set up yet, eggs cannot be placed');
      return;
    }

    // We'll select 5 random battle zones for egg placement
    const battleZoneCount = this.battleZones.length;
    const selectedZones = new Set<number>();
    
    // Make sure we don't try to place more eggs than we have battle zones
    const eggCount = Math.min(5, battleZoneCount);
    
    // Randomly select 5 unique battle zones
    while (selectedZones.size < eggCount) {
      const randomIndex = Math.floor(Math.random() * battleZoneCount);
      selectedZones.add(randomIndex);
    }
    
    // Create eggs in the selected battle zones
    Array.from(selectedZones).forEach(zoneIndex => {
      const zone = this.battleZones[zoneIndex];
      
      // Place the egg in the center of the battle zone
      const egg = new Egg({
        x: zone.x + zone.width / 2,
        y: zone.y + zone.height / 2,
        texture: eggTexture,
        onCollect: (egg) => this.handleEggCollected(egg)
      });
      
      // Set a low zIndex to ensure eggs are below UI elements
      egg.zIndex = 5;
      
      this.eggs.push(egg);
      this.addChild(egg);
    });
  }
  
  handleEggCollected(egg: Egg): void {
    // Show a message when an egg is collected
    this.showDialogue("You found an easter egg hidden in the tall grass!");
    
    const gameState = GameState.getInstance();
    
    // Add exactly 1 egg to count for each collected egg
    gameState.addEggs(1);
    
    // Get the current egg count after adding 1
    const currentEggCount = gameState.getEggCount();
    console.log("Egg collected! Current count:", currentEggCount);
    
    // Trigger Anda's appearance when 15 or more eggs have been collected
    // (5 from map + 5 from first battle + 5 from second battle)
    if (currentEggCount >= 15) {
      console.log("Reached 15 or more eggs! Anda should appear now");
      
      // Schedule Anda's appearance after the current dialogue closes
      const checkAndShowAndaTimer = setInterval(() => {
        if (!this.showingIntro) {
          clearInterval(checkAndShowAndaTimer);
          // Create Anda when dialogue is closed
          setTimeout(() => {
            console.log("Creating Anda NPC");
            this.createAndaNPC();
          }, 1000);
        }
      }, 100);
    }
  }

  setupDialogueBox({ viewWidth }: IMapScreenOptions): void {
    this.dialogueBox = new DialogueBox({
      boxWidth: viewWidth,
      onClick: this.hideDialogue
    });
    
    // Instead of adding to the map, add to the move interface
    // which follows the screen rather than the map
    this.moveInterface.addChild(this.dialogueBox);
    
    // Position at the bottom of the screen
    this.dialogueBox.y = this.moveInterface.height - this.dialogueBox.boxHeight;
    
    // Ensure dialogue box is above eggs
    this.dialogueBox.zIndex = 10;
    
    // Set initial message
    this.showDialogue("Help baby kich find the 20 easter eggs!");
  }
  
  showDialogue(text: string): void {
    this.dialogueBox.visible = true;
    this.dialogueBox.text.text = text;
    this.showingIntro = true;
  }
  
  hideDialogue = (): void => {
    console.log("Hiding dialogue, queue length:", this.dialogueQueue.length);
    
    // If there's dialogue in the queue, show the next one
    if (this.dialogueQueue.length > 0) {
      const nextDialogue = this.dialogueQueue.shift();
      if (nextDialogue) {
        this.dialogueBox.visible = true;
        this.showingIntro = true;
        this.dialogueBox.text.text = nextDialogue;
        
        // Special handling for specific dialogue messages
        if (nextDialogue === "Anda also found a lily on the way") {
          console.log("Next will show lily");
          // After this dialogue, the next click will show the lily
          this.dialogueQueue = [];  // Clear any other dialogues to ensure sequence
          // Show lily immediately after this dialogue closes
          this.showLily();
          return;
        }
        else if (nextDialogue === "You have received a lily from Anda!") {
          // After this dialogue, we'll show the final message
          this.dialogueQueue = [];  // Clear any other dialogues to ensure sequence
          this.dialogueQueue.push("The End. Happy Easter Sunday! Let's host the next easter hunt together for the kids");
          return;
        }
        return;
      }
    }
    
    // If we reach here, there's no more dialogue to show
    this.dialogueBox.visible = false;
    this.showingIntro = false;
  }

  setupLayers ({ collisionsLayer, battleZonesLayer }: IMapScreenOptions): void {
    const { tilesPerRow } = this
    for (let i = 0; i < collisionsLayer.data.length; i += tilesPerRow) {
      const row = collisionsLayer.data.slice(i, tilesPerRow + i)
      row.forEach((symbol, j) => {
        if (symbol === 1025) {
          const boundary = new Boundary({
            rect: {
              x: j * this.cellWidth,
              y: i / tilesPerRow * this.cellHeight,
              width: this.cellWidth,
              height: this.cellHeight
            }
          })
          this.boundaries.push(boundary)
          this.addChild(boundary)
        }
      })
    }

    for (let i = 0; i < battleZonesLayer.data.length; i += tilesPerRow) {
      const row = battleZonesLayer.data.slice(i, tilesPerRow + i)
      row.forEach((symbol, j) => {
        if (symbol === 1025) {
          const boundary = new Boundary({
            rect: {
              x: j * this.cellWidth,
              y: i / tilesPerRow * this.cellHeight,
              width: this.cellWidth,
              height: this.cellHeight
            },
            fillColor: 0x0000ff
          })
          this.battleZones.push(boundary)
          this.addChild(boundary)
        }
      })
    }
  }

  setupBackground ({ mapSprites: { background } }: IMapScreenOptions): void {
    const bgSpr = new Sprite(background)
    this.addChild(bgSpr)
    this.background = bgSpr
  }

  setupPlayer ({ playerSprites: { up, left, right, down } }: IMapScreenOptions): void {
    this.player = new Player({
      position: {
        x: 1225,
        y: 880
      },
      sprites: {
        up,
        left,
        right,
        down
      }
    })

    this.addChild(this.player)
  }

  setupForeground ({ mapSprites: { foreground } }: IMapScreenOptions): void {
    const fgSpr = new Sprite(foreground)
    this.addChild(fgSpr)
    this.foreground = fgSpr
  }

  activate (): void {
    this.isActive = true
    this.addEventLesteners()
    AUDIO.Map.play()
    
    // Show intro dialogue when map is activated
    this.showDialogue("Help baby kich find the 20 easter eggs!");
  }

  deactivate (): void {
    this.isActive = false
    this.removeEventLesteners()
    this.player.releaseAllImpulse()
    AUDIO.Map.stop()
  }

  handleScreenTick (): void {
    if (!this.isActive) {
      return
    }
    
    // If showing intro dialogue, don't allow movement
    if (this.showingIntro) {
      this.player.releaseAllImpulse();
      return;
    }

    // Check if the player has reached 15 eggs and Anda should appear
    const currentEggCount = GameState.getInstance().getEggCount();
    // Only create Anda if: 
    // 1. Egg count >= 15
    // 2. Anda doesn't exist yet
    // 3. We're not already in the game ending sequence
    // 4. We haven't already started Anda creation
    if (currentEggCount >= 15 && !this.anda && !this.isGameEnding && !this._andaCreationStarted) {
      console.log("Egg count check in tick: " + currentEggCount + " - Spawning Anda");
      // Set flag to prevent multiple Anda creations
      this._andaCreationStarted = true;
      this.createAndaNPC();
    }

    let isMovingHorizontal = false
    const horizontalPlayerImpulse = this.player.getHorizontalImpulse()
    if (horizontalPlayerImpulse !== 0) {
      isMovingHorizontal = true
      const pRectHor = {
        x: this.player.x + horizontalPlayerImpulse,
        y: this.player.y,
        width: this.player.width,
        height: this.player.height
      }
      for (let i = 0; i < this.boundaries.length; i++) {
        const boundary = this.boundaries[i]
        if (
          rectangularCollision({
            rect1: pRectHor,
            rect2: boundary
          })
        ) {
          logPlayerCollision('Horizontal collision detected! Player stopped')
          isMovingHorizontal = false
          break
        }
      }
    }

    let isMovingVertical = false
    const verticalPlayerImpulse = this.player.getVerticalImpulse()
    if (verticalPlayerImpulse !== 0) {
      isMovingVertical = true
      const pRectVer = {
        x: this.player.x,
        y: this.player.y + verticalPlayerImpulse,
        width: this.player.width,
        height: this.player.height
      }
      for (let i = 0; i < this.boundaries.length; i++) {
        const boundary = this.boundaries[i]
        if (
          rectangularCollision({
            rect1: pRectVer,
            rect2: boundary
          })
        ) {
          logPlayerCollision('Vertical collision detected! Player stopped')
          isMovingVertical = false
          break
        }
      }
    }

    if (horizontalPlayerImpulse > 0 || verticalPlayerImpulse > 0) {
      if (!this.playerMoveInitialized) {
        if (!AUDIO.Map.playing()) {
          AUDIO.Map.play()
        }
      }
      this.playerMoveInitialized = true
      for (let i = 0; i < this.battleZones.length; i++) {
        const battleZone = this.battleZones[i]
        const overlappingArea =
        (Math.min(
          this.player.x + this.player.width,
          battleZone.x + battleZone.width
        ) -
          Math.max(this.player.x, battleZone.x)) *
        (Math.min(
          this.player.y + this.player.height,
          battleZone.y + battleZone.height
        ) -
          Math.max(this.player.y, battleZone.y))
        if (
          rectangularCollision({
            rect1: this.player,
            rect2: battleZone
          }) &&
            overlappingArea > (this.player.width * this.player.height) * this.overlappingBattleTrigger &&
            Math.random() <= this.overlappingBattleChance &&
            GameState.getInstance().canBattle()
        ) {
          logPlayerCollision('Battle zone triggered')
          this.onBattleStart()
        }
      }
    }

    // Check for egg collisions
    for (const egg of this.eggs) {
      egg.checkCollision(this.player);
    }
    
    // Update Anda's position if it exists
    if (this.anda) {
      this.updateAnda();
    }

    if (isMovingHorizontal) {
      this.player.x += horizontalPlayerImpulse

      this.x -= horizontalPlayerImpulse

      this.moveInterface.x += horizontalPlayerImpulse
    }

    if (isMovingVertical) {
      this.player.y += verticalPlayerImpulse

      this.y -= verticalPlayerImpulse

      this.moveInterface.y += verticalPlayerImpulse
    }
  }

  addEventLesteners (): void {
    window.addEventListener('keydown', this.handleKeydown)
    window.addEventListener('keyup', this.handleKeyup)
  }

  removeEventLesteners (): void {
    window.removeEventListener('keydown', this.handleKeydown)
    window.removeEventListener('keyup', this.handleKeyup)
  }

  handleKeydown = (e: KeyboardEvent): void => {
    // Don't process movement keys if showing dialogue
    if (this.showingIntro) return;
    
    const { player } = this
    logKeydown(`${e.code} ${e.key}`)
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        player.addUpImpulse()
        break
      case 'KeyA':
      case 'ArrowLeft':
        player.addLeftImpulse()
        break
      case 'KeyS':
      case 'ArrowDown':
        player.addDownImpulse()
        break
      case 'KeyD':
      case 'ArrowRight':
        player.addRightImpulse()
        break
    }
  }

  handleKeyup = (e: KeyboardEvent): void => {
    const { player } = this
    logKeyup(`${e.code} ${e.key}`)
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        player.subUpImpulse()
        break
      case 'KeyA':
      case 'ArrowLeft':
        player.subLeftImpulse()
        break
      case 'KeyS':
      case 'ArrowDown':
        player.subDownImpulse()
        break
      case 'KeyD':
      case 'ArrowRight':
        player.subRightImpulse()
        break
    }
  }

  setupMoveInterface ({ viewWidth, viewHeight }: IMapScreenOptions): void {
    const moveInterface = new MoveInterface({
      viewWidth,
      viewHeight,
      playerWidth: this.player.width,
      playerHeight: this.player.height,
      onDirectionPressedChange: this.handleDirectionPressedChange
    })
    this.addChild(moveInterface)
    this.moveInterface = moveInterface
    
    // Ensure the move interface (and its children like dialogue) are above other elements
    moveInterface.zIndex = 100;
  }

  resizeMoveInterface ({ viewWidth, viewHeight }: Parameters<IScreen['handleScreenResize']>[0]): void {
    this.moveInterface.x = (this.player.x + this.player.width / 2) - viewWidth / 2
    this.moveInterface.y = (this.player.y + this.player.height / 2) - viewHeight / 2

    this.moveInterface.width = viewWidth
    this.moveInterface.height = viewHeight
    
    // Update dialogue box position on resize
    if (this.dialogueBox) {
      this.dialogueBox.y = viewHeight - this.dialogueBox.boxHeight;
      this.dialogueBox.draw({ boxWidth: viewWidth, onClick: this.hideDialogue });
    }
  }

  centerCamera ({ viewWidth, viewHeight }: Parameters<IScreen['handleScreenResize']>[0]): void {
    this.x = -(this.player.x + this.player.width / 2) + viewWidth / 2
    this.y = -(this.player.y + this.player.height / 2) + viewHeight / 2
  }

  handleScreenResize (options: Parameters<IScreen['handleScreenResize']>[0]): void {
    this.centerCamera(options)
    this.resizeMoveInterface(options)
  }

  handleDirectionPressedChange = (): void => {
    // Don't process movement if showing dialogue
    if (this.showingIntro) return;
    
    const { up, right, down, left } = this.moveInterface.directionPressed
    this.player.setImpulse({
      up,
      right,
      down,
      left
    })
  }

  // Add methods to create and handle the NPC
  createAndaNPC(): void {
    // Get the sprites from the map screen setup
    const { up, left, right, down } = this.player;
    
    // Create NPC at a position near but outside the player's view
    const playerX = this.player.x;
    const playerY = this.player.y;
    
    // Position Anda away from the player
    const offsetX = 500; // Spawn 500 pixels to the right
    const offsetY = 0;   // At the same Y coordinate
    
    // Create Anda using the same sprites as the player
    this.anda = new NPC({
      position: {
        x: playerX + offsetX,
        y: playerY + offsetY
      },
      sprites: {
        // We need to get the textures from the player's animated sprites
        up: up.textures as Texture[],
        left: left.textures as Texture[],
        right: right.textures as Texture[],
        down: down.textures as Texture[]
      },
      name: 'Anda'
    });
    
    // Set Z-index to appear in front of most map objects
    this.anda.zIndex = 10;
    
    // Add Anda to the map
    this.addChild(this.anda);
    
    // Play animation
    this.anda.playAnimation();
  }
  
  updateAnda(): void {
    if (!this.anda) return;
    
    // If NPC has not reached player yet, move towards player
    if (!this.anda.targetReached) {
      this.anda.moveTowardsTarget(this.player, this.boundaries);
      
      // Update position based on impulse
      const horizontalImpulse = this.anda.getHorizontalImpulse();
      const verticalImpulse = this.anda.getVerticalImpulse();
      
      if (horizontalImpulse !== 0) {
        this.anda.x += horizontalImpulse;
      }
      
      if (verticalImpulse !== 0) {
        this.anda.y += verticalImpulse;
      }
    } 
    // If target is reached and hasn't interacted yet, interact with player
    else if (!this.anda.hasInteracted) {
      this.anda.hasInteracted = true;
      this.handleAndaInteraction();
    }
  }
  
  handleAndaInteraction(): void {
    if (!this.anda) return;
    
    console.log("Anda interaction started");
    
    // Mark the game as ending so we can start the ending sequence
    this.isGameEnding = true;
    
    // Clear any existing dialogue queue
    this.dialogueQueue = [];
    
    // Show dialogue with the first message
    this.showDialogue(`${this.anda.name} helped you find the last 5 easter eggs! You now have all 20 eggs!`);
    
    // Queue up the next dialogue
    this.dialogueQueue.push("Anda also found a lily on the way");
    
    // Add the 5 eggs to the count
    GameState.getInstance().addEggs(5);
    
    // Log for debugging
    console.log("Anda interaction complete, eggs added:", GameState.getInstance().getEggCount());
  }
  
  showLily(): void {
    console.log("Showing lily - start");
    
    // Create a semi-transparent overlay for the entire screen
    this.overlay = new Graphics();
    this.overlay.beginFill(0x000000, 0.7); // Make it darker for better contrast
    this.overlay.drawRect(0, 0, this.moveInterface.width, this.moveInterface.height);
    this.overlay.endFill();
    this.overlay.zIndex = 90;
    this.moveInterface.addChild(this.overlay);
    
    // Create the lily sprite with a timestamp to prevent caching
    const timestamp = new Date().getTime();
    this.lily = Sprite.from(`assets/images/lily.png?t=${timestamp}`);
    
    // Center the lily properly
    this.lily.anchor.set(0.5, 0.5);
    
    // Position in the exact center of the screen
    this.lily.x = this.moveInterface.width / 2;
    this.lily.y = this.moveInterface.height / 2;
    
    // Make it smaller as requested
    this.lily.scale.set(0.5, 0.5);
    
    // Ensure it appears above the overlay
    this.lily.zIndex = 95;
    
    // Add to the move interface to ensure it stays on screen
    this.moveInterface.addChild(this.lily);
    
    // Make sure it's visible
    this.lily.visible = true;
    
    // Ensure sortable children is enabled
    this.moveInterface.sortableChildren = true;
    
    console.log("Lily created and added to stage");
    
    // Automatically continue to next dialogue after 2 seconds
    setTimeout(() => {
      console.log("Auto-continuing after lily display");
      // Hide the lily and overlay
      if (this.lily) {
        this.moveInterface.removeChild(this.lily);
        this.lily = null;
      }
      if (this.overlay) {
        this.moveInterface.removeChild(this.overlay);
        this.overlay = null;
      }
      
      // Show the next dialogue - lily has been received
      this.showDialogue("You have received a lily from Anda!");
      
      // Clear any existing queue and add the final message
      this.dialogueQueue = [];
      this.dialogueQueue.push("The End. Happy Easter Sunday! Let's host the next easter hunt together for the kids. I love you, Kich");
    }, 2000); // Show for 2 seconds
  }
  
  createRetryButton(): void {
    // Create a retry button container
    this.retryButton = new Container();
    this.retryButton.zIndex = 100;
    
    // Create button background
    const buttonBg = new Graphics();
    buttonBg.beginFill(0x4CAF50);
    buttonBg.lineStyle(4, 0x45A049);
    buttonBg.drawRoundedRect(0, 0, 200, 60, 10);
    buttonBg.endFill();
    this.retryButton.addChild(buttonBg);
    
    // Create button text
    const style = new TextStyle({
      fontFamily: 'Press Start 2P, Arial',
      fontSize: 20,
      fontWeight: 'bold',
      fill: ['#FFFFFF']
    });
    
    const buttonText = new Text('Play Again', style);
    buttonText.anchor.set(0.5, 0.5);
    buttonText.x = 100;
    buttonText.y = 30;
    this.retryButton.addChild(buttonText);
    
    // Position the button in the center of the screen
    this.retryButton.x = (this.moveInterface.width / 2) - 100;
    this.retryButton.y = (this.moveInterface.height / 2) + 100;
    
    // Make the button interactive
    this.retryButton.interactive = true;
    this.retryButton.cursor = 'pointer';
    this.retryButton.on('pointerdown', this.handleRetryClick);
    
    // Add the button to the interface
    this.moveInterface.addChild(this.retryButton);
  }
  
  handleRetryClick = (): void => {
    console.log("Retry button clicked - resetting game");
    
    // Reset the game state
    GameState.getInstance().reset();
    
    // Remove ending elements
    if (this.retryButton) {
      this.moveInterface.removeChild(this.retryButton);
      this.retryButton = null;
    }
    
    if (this.lily) {
      this.moveInterface.removeChild(this.lily);
      this.lily = null;
    }
    
    if (this.overlay) {
      this.moveInterface.removeChild(this.overlay);
      this.overlay = null;
    }
    
    if (this.anda) {
      this.removeChild(this.anda);
      this.anda = null;
    }
    
    // Reset all eggs
    for (const egg of this.eggs) {
      if (egg.parent) {
        egg.parent.removeChild(egg);
      }
    }
    this.eggs = [];
    
    // Reset dialogue and game state
    this.isGameEnding = false;
    this._andaCreationStarted = false;
    this.dialogueQueue = [];
    
    // Reset player position to starting point
    this.player.x = 1225;  // Original starting position from setupPlayer
    this.player.y = 880;
    
    // Re-center the camera
    this.centerCamera({
      viewWidth: this.moveInterface.width,
      viewHeight: this.moveInterface.height
    });
    
    // Reset all impulses
    this.player.releaseAllImpulse();
    
    // Regenerate eggs
    const options = {
      eggTexture: this.gameLoader.eggTexture
    };
    this.setupEggs(options as IMapScreenOptions);
    
    // Show intro dialogue
    this.showDialogue("Help baby kich find the 20 easter eggs!");
  }
}
