import { clearLine, cursorTo } from "readline"

export class Spinner {
  stream: NodeJS.WriteStream & { fd: 1 } = process.stdout
  text: string = ""
  chars: string = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
  charIndex: number = 0
  delay: number = 60
  id?: NodeJS.Timer

  private reset() {
    clearLine(this.stream, 0)
    cursorTo(this.stream, 0)
  }

  private write() {
    const message = `${this.chars[this.charIndex]} ${this.text}`
    this.reset()
    this.stream.write(message)
    this.charIndex = (this.charIndex + 1) % this.chars.length
  }

  start(text: string) {
    this.text = text
    this.id = setInterval(this.write.bind(this), this.delay)
  }

  stop(text: string) {
    clearLine(this.stream, 0)
    cursorTo(this.stream, 0)
    this.stream.write(text + "\n")
    clearInterval(this.id)
  }
}
