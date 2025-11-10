import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  // Puntuación global
  score = signal(0);

  // Diccionario (para Letras)
  private dictionary: string[] = [];
  dictionaryLoaded = signal(false);

  // Conjuntos de números (para Cifras)
  private smallNumbers = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];
  private largeNumbers = [25, 50, 75, 100];

  // Frecuencias de letras en español (más realistas)
  private vowelFrequencies = {
    'A': 12, 'E': 14, 'I': 6, 'O': 9, 'U': 4
  } as const;

  private consonantFrequencies = {
    'B': 2, 'C': 4, 'D': 5, 'F': 1, 'G': 2,
    'H': 1, 'J': 1, 'K': 0, 'L': 5, 'M': 3,
    'N': 7, 'P': 3, 'Q': 1, 'R': 7, 'S': 8,
    'T': 5, 'V': 1, 'W': 0, 'X': 0, 'Y': 1, 'Z': 1
  } as const;

  constructor(private http: HttpClient) {
    this.loadDictionary();
  }

  // -------------------------
  // DICCIONARIO (Letras)
  // -------------------------
  private async loadDictionary() {
    try {
      const data = await firstValueFrom(this.http.get<string[]>('/assets/diccionario.json'));
      this.dictionary = data.map(word => word.toLowerCase().trim());
      this.dictionaryLoaded.set(true);
      console.log('Diccionario cargado:', this.dictionary.length, 'palabras');
    } catch (error) {
      console.error('Error cargando diccionario:', error);
      // Fallback mínimo
      this.dictionary = ['casa', 'perro', 'gato', 'mesa', 'silla', 'libro', 'agua', 'fuego', 'tierra', 'viento'];
      this.dictionaryLoaded.set(true);
    }
  }

  // Generar letra según frecuencia
  private getWeightedLetter(frequencies: Record<string, number>): string {
    const letters = Object.keys(frequencies);
    const weights = Object.values(frequencies);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < letters.length; i++) {
      random -= weights[i];
      if (random <= 0) return letters[i];
    }
    return letters[letters.length - 1];
  }

  // LETRAS: Generar letras con frecuencias realistas
  generateCustomLetters(vowelsCount: number): string[] {
    const letters: string[] = [];
    const consonantsCount = 9 - vowelsCount;

    for (let i = 0; i < vowelsCount; i++) {
      letters.push(this.getWeightedLetter(this.vowelFrequencies as unknown as Record<string, number>));
    }
    for (let i = 0; i < consonantsCount; i++) {
      letters.push(this.getWeightedLetter(this.consonantFrequencies as unknown as Record<string, number>));
    }

    return letters.sort(() => Math.random() - 0.5);
  }

  // Validar palabra (mínimo 5 letras)
  validateWord(word: string, availableLetters: string[]): { valid: boolean; points: number; reason?: string } {
    if (!word || word.trim() === '') {
      return { valid: false, points: 0, reason: 'No has escrito ninguna palabra' };
    }

    const normalizedWord = word.toUpperCase().trim();
    if (normalizedWord.length < 5) {
      return { valid: false, points: 0, reason: 'La palabra debe tener al menos 5 letras' };
    }

    const lettersCopy = [...availableLetters];
    for (const char of normalizedWord) {
      const index = lettersCopy.indexOf(char);
      if (index === -1) {
        return { valid: false, points: 0, reason: 'Usas letras que no están disponibles' };
      }
      lettersCopy.splice(index, 1);
    }

    const exists = this.dictionary.includes(normalizedWord.toLowerCase());
    if (!exists) {
      return { valid: false, points: 0, reason: 'La palabra no existe en el diccionario' };
    }

    const points = normalizedWord.length;
    return { valid: true, points, reason: 'Palabra válida' };
  }

  // Buscar la palabra más larga posible
  findBestWord(letters: string[]): string | null {
    if (!this.dictionaryLoaded()) return null;

    let bestWord: string | null = null;
    let maxLength = 0;

    for (const w of this.dictionary) {
      if (w.length < 5 || w.length <= maxLength) continue;

      const lettersCopy = [...letters];
      let canForm = true;

      for (const ch of w.toUpperCase()) {
        const idx = lettersCopy.indexOf(ch);
        if (idx === -1) { canForm = false; break; }
        lettersCopy.splice(idx, 1);
      }

      if (canForm && w.length > maxLength) {
        maxLength = w.length;
        bestWord = w;
      }
    }
    return bestWord;
  }

  // -------------------------
  // CIFRAS
  // -------------------------
  // Generar set de números + objetivo
  generateCustomNumbers(largeCount: number, smallCount: number): { numbers: number[]; target: number } {
    const numbers: number[] = [];
    const availableSmall = [...this.smallNumbers];
    const availableLarge = [...this.largeNumbers];

    for (let i = 0; i < largeCount; i++) {
      const idx = Math.floor(Math.random() * availableLarge.length);
      numbers.push(availableLarge[idx]);
      availableLarge.splice(idx, 1);
    }
    for (let i = 0; i < smallCount; i++) {
      const idx = Math.floor(Math.random() * availableSmall.length);
      numbers.push(availableSmall[idx]);
      availableSmall.splice(idx, 1);
    }

    const shuffled = numbers.sort(() => Math.random() - 0.5);
    const target = Math.floor(Math.random() * 900) + 100; // 100–999
    return { numbers: shuffled, target };
  }

  /**
   * Solver estilo "Countdown":
   * - Devuelve solución exacta si existe.
   * - Si no, la mejor aproximación encontrada (valor más cercano).
   * - Solo construye expresiones con +, −, ×, ÷ (división entera).
   * - NO usa eval. Expresiones devueltas usan símbolos bonitos (×, ÷) para mostrar.
   */
  findNumberSolution(numbers: number[], target: number): { expression: string; result: number } | null {
    type Node = { val: number; expr: string };
    const start: Node[] = numbers.map(n => ({ val: n, expr: n.toString() }));
    let best: { expression: string; result: number } | null = null;

    // memo para estados (multiconjunto de valores)
    const seen = new Set<string>();
    const keyOf = (vals: number[]) => vals.slice().sort((a, b) => a - b).join(',');

    const tryUpdateBest = (cand: Node) => {
      if (!best) { best = { expression: cand.expr, result: cand.val }; return; }
      const curDiff = Math.abs(best.result - target);
      const newDiff = Math.abs(cand.val - target);
      if (newDiff < curDiff) best = { expression: cand.expr, result: cand.val };
    };

    function search(nodes: Node[]): boolean {
      // ¿algún valor exacto?
      for (const n of nodes) {
        if (n.val === target) { best = { expression: n.expr, result: n.val }; return true; }
        tryUpdateBest(n);
      }
      if (nodes.length < 2) return false;

      // evita recomputar el mismo estado
      const key = keyOf(nodes.map(n => n.val));
      if (seen.has(key)) return false;
      seen.add(key);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const rest = nodes.filter((_, idx) => idx !== i && idx !== j);

          // Candidatos básicos
          const cand: Node[] = [
            { val: a.val + b.val, expr: `(${a.expr} + ${b.expr})` },
            { val: a.val - b.val, expr: `(${a.expr} - ${b.expr})` },
            { val: b.val - a.val, expr: `(${b.expr} - ${a.expr})` },
            { val: a.val * b.val, expr: `(${a.expr} × ${b.expr})` },
          ];

          // Divisiones ENTERAS (regla típica)
          if (b.val !== 0 && a.val % b.val === 0) {
            cand.push({ val: Math.trunc(a.val / b.val), expr: `(${a.expr} ÷ ${b.expr})` });
          }
          if (a.val !== 0 && b.val % a.val === 0) {
            cand.push({ val: Math.trunc(b.val / a.val), expr: `(${b.expr} ÷ ${a.expr})` });
          }

          for (const c of cand) {
            if (!Number.isFinite(c.val)) continue;
            // Opcional: descartar <=0 si no quieres permitirlos:
            // if (c.val <= 0) continue;

            if (search([...rest, c])) return true; // corta si ya exacto
          }
        }
      }
      return false;
    }

    search(start);
    return best;
  }

  // Puntuación global
  addPoints(points: number) {
    this.score.update(s => s + points);
  }
}
