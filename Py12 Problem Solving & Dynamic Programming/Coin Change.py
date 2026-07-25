def minimum_coins(coins, amount):
    """Return the fewest coins that form amount, or -1 when impossible."""
    unreachable = amount + 1
    best = [0] + [unreachable] * amount
    for total in range(1, amount + 1):
        for coin in coins:
            if coin <= total:
                best[total] = min(best[total], best[total - coin] + 1)
    return -1 if best[amount] == unreachable else best[amount]
