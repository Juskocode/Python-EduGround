n = int(input())
for i in range(n):
    number = n - i
    for j in range(number):
        print(number - j, end=" ")
    print()