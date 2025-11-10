import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-letras',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './letras.component.html',
  styleUrl: './letras.component.scss'
})
export class LetrasComponent implements OnInit, OnDestroy {
  letters: string[] = [];
  /** Una entrada por ficha; true = usada */
  used: boolean[] = [];
  /** Pila con los índices de ficha usados en orden de escritura */
  usedIndexStack: number[] = [];

  userWord = '';
  timeLeft = 60;
  gameStarted = false;
  gameEnded = false;
  isValid = false;
  errorMessage = '';
  points = 0;
  timerInterval: any;

  setupMode = true;
  vowelsCount = 4;
  bestPossibleWord: string | null = null;

  @ViewChild('wordInput') wordInput!: ElementRef<HTMLInputElement>;

  constructor(
    private gameService: GameService,
    private router: Router
  ) {}

  ngOnInit() {}

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  incrementVowels() { if (this.vowelsCount < 5) this.vowelsCount++; }
  decrementVowels() { if (this.vowelsCount > 3) this.vowelsCount--; }

  startGame() {
    this.letters = this.gameService.generateCustomLetters(this.vowelsCount);
    this.used = new Array(this.letters.length).fill(false);
    this.usedIndexStack = [];

    this.setupMode = false;
    this.gameStarted = true;

    setTimeout(() => {
      this.bestPossibleWord = this.gameService.findBestWord(this.letters);
    }, 0);

    setTimeout(() => this.wordInput?.nativeElement?.focus(), 0);

    this.startTimer();
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) this.endGame();
    }, 1000);
  }

  endGame() {
    clearInterval(this.timerInterval);
    this.gameEnded = true;
    this.validateWord();
  }

  validateWord() {
    const result = this.gameService.validateWord(this.userWord, this.letters);
    this.isValid = result.valid;
    this.points = result.points;
    this.errorMessage = result.reason || '';
    if (this.isValid) this.gameService.addPoints(this.points);
  }

  /** Añade la ficha por índice (clic en botón). */
  addLetterByIndex(index: number) {
    if (this.gameEnded || this.used[index]) return;
    const letter = this.letters[index];
    this.userWord += letter;
    this.used[index] = true;
    this.usedIndexStack.push(index);
  }

  /** Añade una letra (teclado). Busca una ficha libre de esa letra. */
  addLetterToWord(letter: string) {
    if (this.gameEnded) return;
    const idx = this.findFreeIndexFor(letter.toUpperCase());
    if (idx === -1) return; // sin stock de esa letra
    this.addLetterByIndex(idx);
  }

  /** Devuelve el índice de una ficha libre con esa letra, o -1 si no hay. */
  private findFreeIndexFor(letter: string): number {
    for (let i = 0; i < this.letters.length; i++) {
      if (!this.used[i] && this.letters[i].toUpperCase() === letter.toUpperCase()) {
        return i;
      }
    }
    return -1;
  }

  deleteLastLetter() {
    if (this.gameEnded || this.userWord.length === 0) return;
    this.userWord = this.userWord.slice(0, -1);
    const lastIndex = this.usedIndexStack.pop();
    if (lastIndex !== undefined) this.used[lastIndex] = false;
  }

  clearWord() {
    if (this.gameEnded) return;
    this.userWord = '';
    // liberar todas las fichas usadas
    while (this.usedIndexStack.length) {
      const idx = this.usedIndexStack.pop()!;
      this.used[idx] = false;
    }
  }

  goToMenu() { this.router.navigate(['/']); }

  playAgain() {
    this.userWord = '';
    this.timeLeft = 60;
    this.gameStarted = false;
    this.gameEnded = false;
    this.isValid = false;
    this.setupMode = true;
    this.vowelsCount = 4;
    this.bestPossibleWord = null;
    this.errorMessage = '';
    this.points = 0;
    this.used = [];
    this.usedIndexStack = [];
  }

  showSolution(): boolean {
    return !this.isValid && this.bestPossibleWord !== null;
  }

  // --- Teclado global ---
  @HostListener('document:keydown', ['$event'])
  onKeyDown($event: KeyboardEvent) {
    if (!this.gameStarted || this.gameEnded) return;

    const key = $event.key;

    // letras (incluye ñ/Ñ y vocales acentuadas)
    if (/^[a-zA-ZáÁéÉíÍóÓúÚüÜñÑ]$/.test(key)) {
      const before = this.userWord.length;
      this.addLetterToWord(key.toUpperCase());
      if (this.userWord.length !== before) $event.preventDefault(); // solo bloquea si realmente se añadió
      return;
    }

    if (key === 'Backspace') { $event.preventDefault(); this.deleteLastLetter(); return; }
    if (key === 'Enter')     { $event.preventDefault(); this.endGame(); return; }
    if (key === 'Escape')    { $event.preventDefault(); this.clearWord(); return; }
  }
}
