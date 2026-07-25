a = int(input("a = "))
b = int(input("b = "))
sum = a + b
print((sum + 1) % 2 * 2 * sum + sum % 2 * (sum + a * b))