def budgeting(budget, products, wishlist):    
    products_copy = products.copy()
    products_ordered_by_price = []
    for i in range(len(products.keys())):
        max = 0
        for product, price in products_copy.items():
            if price > max:
                max = price
                product_max = product
        products_ordered_by_price.append(product_max)
        del products_copy[product_max]
    
    wishlist_keys_ordered = []
    for product in products_ordered_by_price:
        if product in wishlist.keys():
            wishlist_keys_ordered.append(product)

    result_dict = {}
    for product in wishlist_keys_ordered:
        quantity = wishlist[product]
        for i in range(quantity):
            budget -= products[product]
            if budget >= 0:
                if product in result_dict.keys():
                    result_dict[product] += 1
                else:
                    result_dict[product] = 1
            else:
                return result_dict
    return result_dict

#a mesma coisa só que examina os que têm o preço mais baixo primeiro
#def budgeting(budget, products, wishlist):    
#    products_copy = products.copy()
#    products_ordered_by_price = []
#    for i in range(len(products.keys())):
#        min = budget
#        for product, price in products_copy.items():
#            if price < min:
#                min = price
#                product_min = product
#        products_ordered_by_price.append(product_min)
#        del products_copy[product_min]
#    
#    wishlist_keys_ordered = []
#    for product in products_ordered_by_price:
#        if product in wishlist.keys():
#            wishlist_keys_ordered.append(product)
#
#    result_dict = {}
#    for product in wishlist_keys_ordered:
#        quantity = wishlist[product]
#        for i in range(quantity):
#            budget -= products[product]
#            if budget >= 0:
#                if product in result_dict.keys():
#                    result_dict[product] += 1
#                else:
#                    result_dict[product] = 1
#            else:
#                return result_dict
#    return result_dict