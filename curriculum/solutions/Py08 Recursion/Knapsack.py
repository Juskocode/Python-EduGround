# solução que fiz sem usar recursividade mas que não passa nos testes privados
# from itertools import permutations

# def knapsack(money, products, wishlist):
#     list_of_items = []
#     for item, quantity in wishlist.items():
#         for i in range(quantity):
#             list_of_items.append(item)
#     set_of_items = set(permutations(list_of_items))
#     result_dict = {}
#     for tuple in set_of_items:
#         money_aux = money
#         counter = 0
#         while counter < len(list_of_items):
#             money_aux -= products[tuple[counter]]
#             if money_aux > 0:
#                 counter += 1
#             else:
#                 money_aux += products[tuple[counter]]
#                 break
#         result_tuple = tuple[:counter + 1]
#         result_dict[money_aux] = result_tuple
#     max_tuple = result_dict[max(result_dict.keys())]
#     max_result_dict = {}
#     for element in max_tuple:
#         if element in max_result_dict.keys():
#             max_result_dict[element] += 1
#         else:
#             max_result_dict[element] = 1
#     return max_result_dict




# a usar a recursividade não da forma como o stor pediu, mas ao implementar a função das unordered permutations (outro exercício deste playground)
def knapsack(money, products, wishlist):
    list_of_items = []
    for item, quantity in wishlist.items():
        for i in range(quantity):
            list_of_items.append(item)
    set_of_items = set(permutations(list_of_items))
    result_dict = {}
    for tuple in set_of_items:
        money_aux = money
        counter = 0
        while counter < len(list_of_items):
            money_aux -= products[tuple[counter]]
            if money_aux > 0:
                counter += 1
            else:
                money_aux += products[tuple[counter]]
                break
        result_tuple = tuple[:counter + 1]
        result_dict[money_aux] = result_tuple
    max_tuple = result_dict[max(result_dict.keys())]
    max_result_dict = {}
    for element in max_tuple:
        if element in max_result_dict.keys():
            max_result_dict[element] += 1
        else:
            max_result_dict[element] = 1
    return max_result_dict

# a função  do Unordered permutation.py deste playground
def permutations(atuple):
    if len(atuple) == 1:
        return {atuple,}
    if len(atuple) == 2:
        return {(atuple[0], atuple[1]), (atuple[1], atuple[0])}
    result_set = set()
    for element_position, element in enumerate(atuple):
        sub_permutations = permutations(atuple[:element_position] + atuple[element_position + 1:])
        for i in range(len(sub_permutations)):
            result_set =  result_set | {(element,) + tuple(sub_permutations)[i]}
    return result_set