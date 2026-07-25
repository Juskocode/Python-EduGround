def gcd_rec(n1, n2):
    rest = n1 % n2
    if rest == 0:
        return n2
    return gcd_rec(n2, rest)