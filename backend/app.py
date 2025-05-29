from flask import Flask, jsonify, request
from flask_cors import CORS
from slot_logic import SlotMachine
from config import INITIAL_BALANCE, SERVER_PORT, DEBUG_MODE
import time

app = Flask(__name__)
CORS(app)

machine = SlotMachine(initial_balance=INITIAL_BALANCE)
print(f"Сервер запущен. Слот-машина инициализирована с балансом {INITIAL_BALANCE}.")
print(f"Конфигурация машины: {machine.num_reels} барабанов, {machine.num_rows} рядов.")
print(f"Доступные линии выплат: {len(machine.paylines)}")


@app.route('/state', methods=['GET'])
def get_state():
    return jsonify(machine.get_state())


@app.route('/spin', methods=['POST'])
def handle_spin():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON", "balance": machine.get_balance()}), 400

    data = request.get_json()
    bet_amount = data.get('bet', machine.spin_cost)

    if not isinstance(bet_amount, int) or bet_amount <= 0:
        return jsonify({"error": "Invalid bet amount", "balance": machine.get_balance()}), 400

    try:
        spin_result = machine.spin(bet=bet_amount)
    except Exception as e:
        print(f"Error during spin logic: {e}")
        return jsonify({"error": "An internal error occurred during spin.", "balance": machine.get_balance()}), 500

    if spin_result is None:
        return jsonify({
            'error': 'Insufficient funds or invalid bet',
            'balance': machine.get_balance()
        }), 400

    grid, current_balance, payout_info = spin_result

    return jsonify({
        'grid': grid,
        'balance': current_balance,
        'payout': payout_info,
        'spin_cost': bet_amount
    })


@app.route('/add_funds', methods=['POST'])
def handle_add_funds():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    amount = data.get('amount')

    if amount is None or not isinstance(amount, int) or amount <= 0:
        return jsonify({"error": "Invalid amount specified"}), 400

    machine.add_funds(amount)
    return jsonify({
        "message": f"{amount} added.",
        "new_balance": machine.get_balance()
    })


@app.route('/rtp', methods=['GET'])
def get_rtp():
    return jsonify({
        'rtp': machine.DEFAULT_RTP,
        'symbol_weights': machine.reel_weights
    })


@app.route('/', methods=['GET'])
def index():
    return ("<h1>Сервер слот-машины работает!</h1><p>Доступные эндпоинты: /state (GET), /spin (POST), /add_funds (POST), /rtp (GET)</p>")

def benchmark_rtp_inline(machine, num_spins=10000, bet=1):
    total_bet = 0
    total_win = 0

    for i in range(num_spins):
        try:
            result = machine.spin(bet=bet)
            if result is None:
                machine.add_funds(10000)  # пополняем баланс чтобы не падало
                result = machine.spin(bet=bet)

            grid, _, payout_info = result
            total_win += payout_info.get('amount', 0)
            total_bet += bet

            if (i + 1) % 1000 == 0:
                print(f"{i + 1}/{num_spins} spins...")

        except Exception as e:
            print(f"Error during spin {i}: {e}")

    actual_rtp = total_win / total_bet if total_bet else 0
    print("\n🎯 RTP тест завершён:")
    print(f"  ➤ Ставок всего: {total_bet}")
    print(f"  ➤ Выигрышей всего: {total_win}")
    print(f"  ➤ Расчётный RTP: {actual_rtp:.4f} ({actual_rtp * 100:.2f}%)")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=SERVER_PORT, debug=DEBUG_MODE)
    # print("\n🧪 Запуск теста RTP...")
    # benchmark_rtp_inline(machine, num_spins=10000, bet=1)
    # print("✅ Тест RTP завершён\n")
    #
    # app.run(host='0.0.0.0', port=SERVER_PORT, debug=DEBUG_MODE)