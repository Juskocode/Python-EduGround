n = int(input("n = "))
sum = 0
end = n // 2 + 1
for i in range(1, end):
    if n % i == 0:
        sum += i
print(sum + n)