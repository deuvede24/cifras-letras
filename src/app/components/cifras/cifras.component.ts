import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GameService } from '../../services/game.service';

interface HistoryStep {
  display: string;
  operation: string;
  savedResults: SavedItem[];
  availableNumbers: number[];
  lastResult?: number;
}

interface SavedItem {
  id: number;        // único
  value: number;     // resultado (p.ej. 30)
  a: number;         // operando A (p.ej. 6)
  b: number;         // operando B (p.ej. 5)
  op: string;        // '+', '-', '×', '÷'
}

@Component({
  selector: 'app-cifras',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cifras.component.html',
  styleUrl: './cifras.component.scss'
})
export class CifrasComponent implements OnInit, OnDestroy {
  numbers: number[] = [];
  availableNumbers: number[] = [];
  savedResults: SavedItem[] = [];
  largeNumbersCount = 2;
  smallNumbersCount = 4;
  targetNumber = 0;
  currentDisplay = '0';
  currentOperation = '';
  timeLeft = 60;
  gameStarted = false;
  gameEnded = false;
  timerInterval: any;
  lastResult = 0;
  operationHistory: string[] = [];
  bestSolution: { expression: string; result: number } | null = null;
  roundPoints = 0;

  // confirmación “doble toque” para borrar
  private pendingConfirm = new Set<number>(); // guarda ids
  private confirmTimeouts = new Map<number, any>();
  private CONFIRM_MS = 1500;

  private history: HistoryStep[] = [];
  private maxHistory = 20;
  private readonly ROUND_SECONDS = 60;
  private nextId = 1;

  constructor(private gameService: GameService, private router: Router) {}

  ngOnInit() { this.startGame(); }
  ngOnDestroy() { if (this.timerInterval) clearInterval(this.timerInterval); }

  get timePercent(): number {
    const safe = Math.max(0, Math.min(this.timeLeft, this.ROUND_SECONDS));
    return (safe / this.ROUND_SECONDS) * 100;
  }

  // Helpers modal
  getDifference(): number { return Math.abs(this.lastResult - this.targetNumber); }
  getScore(): string {
    const diff = this.getDifference();
    if (this.lastResult === 0 && !this.operationHistory.length) return '0 puntos';
    if (diff === 0) return '¡10 PUNTOS! EXACTO';
    if (diff <= 10) return '¡7 PUNTOS!';
    return '0 puntos';
  }
  getSignedDiff(): number { return (this.lastResult || 0) - this.targetNumber; }
  getDiffLabel(): string {
    const d = this.getSignedDiff();
    if (d === 0) return '✔︎';
    const abs = Math.abs(d);
    return d > 0 ? `+${abs}` : `-${abs}`;
  }

  // Undo (Ctrl/Cmd+Z)
  @HostListener('document:keydown.control.z', ['$event'])
  @HostListener('document:keydown.meta.z', ['$event'])
  undo($event: any) {
    $event.preventDefault();
    this.undoLastAction();
  }

  startGame() {
    const game = this.gameService.generateCustomNumbers(this.largeNumbersCount, this.smallNumbersCount);
    this.numbers = game.numbers;
    this.availableNumbers = [...game.numbers];
    this.targetNumber = game.target;
    this.gameStarted = true;
    this.roundPoints = 0;
    this.clearAll(); // limpia estado interno
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
    this.bestSolution = this.gameService.findNumberSolution(this.numbers, this.targetNumber);

    // puntuación: 10 exacto, 7 aproximado (<=10), 0 si no hay resultado o muy lejos
    const diff = Math.abs(this.lastResult - this.targetNumber);
    if (this.lastResult === 0 && !this.operationHistory.length) {
      this.roundPoints = 0;
    } else if (diff === 0) {
      this.roundPoints = 10;
    } else if (diff <= 10) {
      this.roundPoints = 7;
    } else {
      this.roundPoints = 0;
    }
    if (this.roundPoints > 0) this.gameService.addPoints(this.roundPoints);
  }

  private saveState() {
    this.history.push({
      display: this.currentDisplay,
      operation: this.currentOperation,
      savedResults: JSON.parse(JSON.stringify(this.savedResults)),
      availableNumbers: [...this.availableNumbers],
      lastResult: this.lastResult
    });
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  undoLastAction() {
    if (this.history.length === 0 || this.gameEnded) return;
    const prev = this.history.pop()!;
    this.currentDisplay = prev.display;
    this.currentOperation = prev.operation;
    this.savedResults = prev.savedResults;
    this.availableNumbers = prev.availableNumbers;
    this.lastResult = prev.lastResult || 0;
    this.vibrate(50);
  }

  isNumberAvailable(num: number): boolean { return this.availableNumbers.includes(num); }

  appendNumber(num: number) {
    if (this.gameEnded || !this.availableNumbers.includes(num)) return;
    this.saveState();
    if (this.currentDisplay === '0' || this.currentDisplay === 'Error') {
      this.currentDisplay = num.toString();
    } else {
      this.currentDisplay += num.toString();
    }
    this.availableNumbers.splice(this.availableNumbers.indexOf(num), 1);
    this.vibrate();
  }

  appendOperator(op: string) {
    if (this.gameEnded || this.currentDisplay === '0') return;
    this.saveState();
    if (this.currentOperation !== '') this.calculate();
    this.currentOperation = this.currentDisplay + ' ' + op + ' ';
    this.currentDisplay = '0';
    this.vibrate();
  }

  private parseExpr(expr: string): { a: number; op: string; b: number } | null {
    const tokens = expr.split(' ');
    if (tokens.length !== 3) return null;
    const a = parseFloat(tokens[0]), op = tokens[1], b = parseFloat(tokens[2]);
    if (isNaN(a) || isNaN(b)) return null;
    return { a, op, b };
  }

  evaluateExpression(expr: string): number | null {
    const p = this.parseExpr(expr);
    if (!p) return null;
    const { a, op, b } = p;
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : null;
      default: return null;
    }
  }

  calculate() {
    if (!this.currentOperation || this.currentDisplay === '0') return;
    this.saveState();
    const expr = this.currentOperation + this.currentDisplay;
    const result = this.evaluateExpression(expr);

    if (result !== null && !isNaN(result) && isFinite(result)) {
      const parsed = this.parseExpr(expr)!;
      this.lastResult = result;
      this.operationHistory.push(`${expr} = ${result}`);

      // quitar a y b del pool (ya debían haber salido al pulsarlos), por si acaso:
      const idxA = this.availableNumbers.indexOf(parsed.a);
      if (idxA !== -1) this.availableNumbers.splice(idxA, 1);
      const idxB = this.availableNumbers.indexOf(parsed.b);
      if (idxB !== -1) this.availableNumbers.splice(idxB, 1);

      // añadir resultado al banco verde y al pool
      const item: SavedItem = {
        id: this.nextId++,
        value: result,
        a: parsed.a,
        b: parsed.b,
        op: parsed.op
      };
      this.savedResults.push(item);
      this.availableNumbers.push(result);

      // limpiar operación en curso
      this.currentDisplay = '0';
      this.currentOperation = '';
      this.vibrate(100);
    } else {
      this.currentDisplay = 'Error';
      setTimeout(() => this.currentDisplay = '0', 1000);
    }
  }

  useSavedResult(item: SavedItem) {
    if (this.gameEnded) return;
    this.saveState();
    this.currentDisplay = item.value.toString();

    // sacar del banco verde
    const idx = this.savedResults.findIndex(x => x.id === item.id);
    if (idx !== -1) this.savedResults.splice(idx, 1);

    // quitar del pool el valor compuesto
    const availIdx = this.availableNumbers.indexOf(item.value);
    if (availIdx !== -1) this.availableNumbers.splice(availIdx, 1);

    // limpiar confirmación si estuviera activa
    this.cancelConfirm(item.id);

    this.vibrate();
  }

  // Doble toque para borrar con recuperación de operandos
  requestRemove(item: SavedItem) {
    if (this.gameEnded) return;

    if (!this.pendingConfirm.has(item.id)) {
      // primer toque → pide confirmación
      this.pendingConfirm.add(item.id);
      const t = setTimeout(() => this.pendingConfirm.delete(item.id), this.CONFIRM_MS);
      this.confirmTimeouts.set(item.id, t);
      return;
    }

    // segundo toque (confirmado): borra y recupera operandos
    this.saveState();

    // 1) quitar del banco
    const idx = this.savedResults.findIndex(x => x.id === item.id);
    if (idx !== -1) this.savedResults.splice(idx, 1);

    // 2) quitar el resultado del pool si está
    const vIdx = this.availableNumbers.indexOf(item.value);
    if (vIdx !== -1) this.availableNumbers.splice(vIdx, 1);

    // 3) devolver operandos al pool
    this.availableNumbers.push(item.a);
    this.availableNumbers.push(item.b);

    // limpiar confirmación
    this.cancelConfirm(item.id);
    this.vibrate(200);
  }

  isAwaitingConfirm(itemId: number): boolean {
    return this.pendingConfirm.has(itemId);
  }

  private cancelConfirm(itemId: number) {
    this.pendingConfirm.delete(itemId);
    const t = this.confirmTimeouts.get(itemId);
    if (t) clearTimeout(t);
    this.confirmTimeouts.delete(itemId);
  }

  clearAll() {
    this.currentDisplay = '0';
    this.currentOperation = '';
    this.availableNumbers = [...this.numbers];
    this.savedResults = [];
    this.operationHistory = [];
    this.history = [];
    this.pendingConfirm.clear();
    this.confirmTimeouts.forEach(t => clearTimeout(t));
    this.confirmTimeouts.clear();
    this.vibrate();
  }

  getClosestSolution(): string {
    if (!this.bestSolution) return 'No se encontró solución';
    return this.bestSolution.result === this.targetNumber
      ? this.bestSolution.expression
      : `${this.bestSolution.expression} = ${this.bestSolution.result} (cercano)`;
  }

  goToMenu() { this.router.navigate(['/']); }

  playAgain() {
    this.timeLeft = 60;
    this.gameEnded = false;
    this.savedResults = [];
    this.bestSolution = null;
    this.lastResult = 0;
    this.operationHistory = [];
    this.history = [];
    this.currentDisplay = '0';
    this.currentOperation = '';
    this.startGame();
  }

  vibrate(ms: number = 30) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }
}
