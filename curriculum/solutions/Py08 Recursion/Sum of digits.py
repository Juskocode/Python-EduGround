def sum_digits_rec(n):
    if n < 10:
        return n
    n = str(n)
    return int(n[0]) + sum_digits_rec(int(n[1:]))