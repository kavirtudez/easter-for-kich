export class GameState {
  private static instance: GameState;
  private eggCount: number = 0;
  private battleCount: number = 0;
  private maxBattles: number = 2; // Maximum number of battles before disabling more battles

  private constructor() {}

  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  public getEggCount(): number {
    return this.eggCount;
  }

  public addEggs(count: number): void {
    this.eggCount += count;
  }

  public getBattleCount(): number {
    return this.battleCount;
  }

  public incrementBattleCount(): void {
    this.battleCount++;
  }

  public canBattle(): boolean {
    return this.battleCount < this.maxBattles;
  }

  public reset(): void {
    this.eggCount = 0;
    this.battleCount = 0;
  }
} 