distance = int(input("Distance to travel = "))
fuel = float(input("Number of litres of fuel needed to travel 100 km = "))
price = float(input("Price per litre of fuel = "))

print(round(distance / 100 * fuel * price, 2))