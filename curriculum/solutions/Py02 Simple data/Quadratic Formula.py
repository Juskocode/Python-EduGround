from math import sqrt


a = int(input("a = "))
b = int(input("b = "))
c = int(input("c = "))
r1 = round((- b + sqrt(b ** 2 - 4 * a * c)) / (2 * a), 2)
r2 = round((- b - sqrt(b ** 2 - 4 * a * c)) / (2 * a), 2)
print(f"The solutions are {r1} and {r2}")