from math import factorial, sqrt

result = 0
K = 50
for k in range(K + 1):
    result += (factorial(4 * k) * (1103 + 26390 * k)) / (factorial(k) ** 4 * 396 ** (4 * k))
result *= (2 * sqrt(2)) / 9801
print(round(result ** -1, 8))