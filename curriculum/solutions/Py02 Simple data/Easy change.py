price = int(input("price = "))
received = int(input("received = "))
price = received - price
n50 = price // 50
price = price % 50
n20 = price // 20
price = price % 20
n10 = price // 10
price = price % 10
n5 = price // 5
price = price % 5
print(n50, n20, n10, n5)