import random
from typing import Optional, List, Tuple, Dict, Any


class SlotMachine:
    DEFAULT_SYMBOLS = ["Cherry", "Lemon", "Orange", "Plum", "Bell", "Bar", "Seven"]
    PAYOUTS = {
        "Cherry": {3: 2, 4: 5, 5: 10},
        "Lemon": {3: 3, 4: 7, 5: 15},
        "Orange": {3: 4, 4: 9, 5: 20},
        "Plum": {3: 5, 4: 12, 5: 25},
        "Bell": {3: 10, 4: 25, 5: 50},
        "Bar": {3: 15, 4: 35, 5: 75},
        "Seven": {3: 50, 4: 100, 5: 200}
    }
    DEFAULT_REELS = 5
    DEFAULT_ROWS = 3
    DEFAULT_SPIN_COST = 1
    DEFAULT_RTP = 0.95

    SYMBOL_TIERS = {
        "Cherry": 1,
        "Lemon": 1,
        "Orange": 2,
        "Plum": 2,
        "Bell": 3,
        "Bar": 4,
        "Seven": 5
    }

    def __init__(self, initial_balance: int, symbols: Optional[List[str]] = None,
                 num_reels: int = DEFAULT_REELS, num_rows: int = DEFAULT_ROWS,
                 spin_cost: int = DEFAULT_SPIN_COST):
        if initial_balance < 0:
            raise ValueError("Начальный баланс не может быть отрицательным")

        self.symbols = symbols if symbols else self.DEFAULT_SYMBOLS
        if not self.symbols:
            raise ValueError("Список символов не может быть пустым")

        self.balance = initial_balance
        self.num_reels = num_reels
        self.num_rows = num_rows
        self.spin_cost = spin_cost

        self.reel_weights = self._calculate_reel_weights()
        self.paylines = self._generate_paylines()

    def _calculate_reel_weights(self):
        """Генерирует веса символов для каждого барабана с учетом RTP"""
        base_weights = {
            1: 35,
            2: 25,
            3: 15,
            4: 10,
            5: 15
        }

        weights = []
        for reel_idx in range(self.num_reels):
            reel_weight = []
            for symbol in self.symbols:
                tier = self.SYMBOL_TIERS[symbol]
                # Первые барабаны имеют больше низкоуровневых символов
                weight = base_weights[tier] * (1 + (reel_idx * 0.3))
                reel_weight.append(weight)
            weights.append(reel_weight)

        return weights

    def _generate_paylines(self) -> List[Dict[str, Any]]:
        lines = []
        for i in range(self.num_rows):
            lines.append({'index': len(lines), 'cells': [(reel, i) for reel in range(self.num_reels)]})

        if self.num_reels == 5 and self.num_rows == 3:
            lines.append({'index': len(lines), 'cells': [(0, 0), (1, 1), (2, 2), (3, 1), (4, 0)]})
            lines.append({'index': len(lines), 'cells': [(0, 2), (1, 1), (2, 0), (3, 1), (4, 2)]})
        elif self.num_reels == 3 and self.num_rows == 3:
            lines.append({'index': len(lines), 'cells': [(0, 0), (1, 1), (2, 2)]})
            lines.append({'index': len(lines), 'cells': [(0, 2), (1, 1), (2, 0)]})

        for idx, line_def in enumerate(lines):
            line_def['index'] = idx

        return lines

    def _calculate_payout(self, grid: List[List[str]]) -> Tuple[int, List[int]]:
        total_payout_multiplier = 0
        winning_line_indices: List[int] = []

        for line_definition in self.paylines:
            line_idx = line_definition['index']
            cell_coordinates = line_definition['cells']

            symbols_on_line = []
            for r_idx, c_idx in cell_coordinates:
                if 0 <= r_idx < self.num_reels and 0 <= c_idx < self.num_rows:
                    symbols_on_line.append(grid[r_idx][c_idx])
                else:
                    symbols_on_line = []
                    break

            if not symbols_on_line:
                continue

            first_symbol_on_line = symbols_on_line[0]
            consecutive_count = 0
            for symbol in symbols_on_line:
                if symbol == first_symbol_on_line:
                    consecutive_count += 1
                else:
                    break

            payout_for_symbol_type = self.PAYOUTS.get(first_symbol_on_line, {})
            line_payout_multiplier = payout_for_symbol_type.get(consecutive_count, 0)

            if line_payout_multiplier > 0:
                total_payout_multiplier += line_payout_multiplier
                if line_idx not in winning_line_indices:
                    winning_line_indices.append(line_idx)

        return total_payout_multiplier, winning_line_indices

    def spin(self, bet: Optional[int] = None) -> Optional[Tuple[List[List[str]], int, Dict[str, Any]]]:
        current_bet = bet if bet is not None else self.spin_cost

        if not isinstance(current_bet, int) or current_bet <= 0:
            return None

        if self.balance < current_bet:
            return None

        self.balance -= current_bet

        result_grid: List[List[str]] = []
        for reel_idx in range(self.num_reels):
            column = random.choices(
                self.symbols,
                weights=self.reel_weights[reel_idx],
                k=self.num_rows
            )
            result_grid.append(column)

        payout_multiplier, winning_lines_indices = self._calculate_payout(result_grid)
        actual_payout_amount = payout_multiplier * current_bet
        self.balance += actual_payout_amount

        return result_grid, self.balance, {
            'amount': actual_payout_amount,
            'lines': winning_lines_indices,
            'multiplier': payout_multiplier
        }

    def get_balance(self) -> int:
        return self.balance

    def add_funds(self, amount: int):
        if not isinstance(amount, int) or amount <= 0:
            return
        self.balance += amount

    def get_state(self) -> Dict[str, Any]:
        return {
            'balance': self.balance,
            'reels': self.num_reels,
            'rows': self.num_rows,
            'symbols': self.symbols,
            'spinCost': self.spin_cost,
            'paylines': self.paylines
        }