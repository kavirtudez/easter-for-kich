import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GameState } from './GameState';

export class EggCounter extends Container {
  private text: Text;
  private gameState: GameState;
  private box: Graphics;
  private boxWidth = 200;
  private boxHeight = 50;
  private boxColor = 0xffffff;
  private boxBorderThick = 4;
  private boxBorderColor = 0x000000;
  private padding = 10;

  constructor() {
    super();
    this.gameState = GameState.getInstance();
    
    // Create box
    this.box = new Graphics();
    this.draw();
    this.addChild(this.box);
    
    // Create text style
    const style = new TextStyle({
      fontFamily: 'Press Start 2P, Arial',
      fontSize: 16,
      fontWeight: 'bold',
      fill: ['#000000'],
    });

    // Create the text
    this.text = new Text('Eggs: 0', style);
    this.text.x = this.padding;
    this.text.y = this.padding + 5;
    
    this.addChild(this.text);
    
    // Initial update
    this.update();
  }
  
  private draw(): void {
    const { 
      box, boxBorderColor, boxWidth, boxHeight,
      boxColor, boxBorderThick 
    } = this;
    
    box.clear();
    box.beginFill(boxBorderColor);
    box.drawRect(0, 0, boxWidth, boxHeight);
    box.endFill();
    
    box.beginFill(boxColor);
    box.drawRect(
      boxBorderThick, 
      boxBorderThick, 
      boxWidth - boxBorderThick * 2, 
      boxHeight - boxBorderThick * 2
    );
    box.endFill();
  }

  public update(): void {
    const gameState = this.gameState;
    this.text.text = `Eggs: ${gameState.getEggCount()}/20`;
  }
} 