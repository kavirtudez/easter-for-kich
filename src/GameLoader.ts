import { Assets, type Spritesheet, Texture } from 'pixi.js'

export interface TTileLayer {
  data: number[]
  height: number
  id: number
  name: string
  opacity: number
  type: 'tilelayer'
  visible: boolean
  width: number
  x: number
  y: number
}

export interface TGroupLayer {
  id: number
  layers: TTileLayer[]
  name: string
  opacity: number
  type: 'group'
  visible: boolean
  x: number
  y: number
}

export interface TSettings {
  compressionlevel: number
  height: number
  infinite: boolean
  layers: Array<TTileLayer | TGroupLayer>
  nextlayerid: number
  nextobjectid: number
  orientation: 'orthogonal'
  renderorder: 'right-down'
  tiledversion: number
  tileheight: number
}

type ImgTexture = Texture

export class GameLoader {
  loader: typeof Assets
  settings!: TSettings
  spritesheet!: Spritesheet
  public worldBackgroundTexture!: Texture
  public worldForegroundTexture!: Texture
  public battleBackgroundTexture!: Texture
  public eggTexture!: Texture
  public lilyTexture!: Texture
  constructor () {
    this.loader = Assets
  }

  async loadAll (): Promise<void> {
    await this.loadSettings()
    await this.loadResources()
    await this.loadImages()
  }

  async loadSettings (): Promise<void> {
    this.settings = await fetch('settings.json').then(async (res) => await res.json())
  }

  async loadResources (): Promise<void> {
    this.loader.add('tileset', 'assets/spritesheets/spritesheet.json')
    this.spritesheet = await this.loader.load('tileset')
  }

  async loadImage (url: string): Promise<Texture> {
    const res = await fetch(url)
    const imageBlob = await res.blob()
    const blobURL = URL.createObjectURL(imageBlob)
    return await Texture.fromURL(blobURL)
  }

  async loadImages (): Promise<void> {
    const [worldBgTexture, worldFgTexture, battleBgTexture, eggTexture, lilyTexture] = await Promise.all([
      this.loadImage('assets/images/World-Background.png'),
      this.loadImage('assets/images/World-Foreground.png'),
      this.loadImage('assets/images/Battle-Background.png'),
      this.loadImage('assets/images/egg.png'),
      this.loadImage('assets/images/lily.png')
    ])
    this.worldBackgroundTexture = worldBgTexture
    this.worldForegroundTexture = worldFgTexture
    this.battleBackgroundTexture = battleBgTexture
    this.eggTexture = eggTexture
    this.lilyTexture = lilyTexture
  }
}
