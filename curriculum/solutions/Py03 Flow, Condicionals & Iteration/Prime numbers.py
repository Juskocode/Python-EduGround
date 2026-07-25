lower = int(input())
upper = int(input())

prime_numbers = []

for i in range(abs(lower), abs(upper) + 1):
    is_prime = True
    for j in range(2, i // 2 + 1):
        if i % j == 0:
            is_prime = False
            break
    if is_prime == True:
        prime_numbers.append(i)

print(f"Prime numbers between {lower} and {upper} are:", end="")
for i in prime_numbers:
    print(" " + str(i), end="")