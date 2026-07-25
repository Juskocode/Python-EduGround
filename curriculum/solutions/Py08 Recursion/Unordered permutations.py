# manualmente o q as 3 primeiras cenas fazem
# def permutations(atuple):
#     if len(atuple) == 1:
#         return {atuple,}
#     if len(atuple) == 2:
#         return {(atuple[0], atuple[1]), (atuple[1], atuple[0])}
#     if len(atuple) == 3:
#         return {(atuple[0], atuple[1], atuple[2]), (atuple[0], atuple[2], atuple[1]), (atuple[1], atuple[0], atuple[2]), (atuple[1], atuple[2], atuple[0]), (atuple[2], atuple[0], atuple[1]), (atuple[2], atuple[1], atuple[0])}
#         # <=> (a mesma coisa só que a dizer o que representa)
#         return {(atuple[0],) + tuple(permutations(atuple[:0] + atuple[0 + 1:]))[0], (atuple[0],) + tuple(permutations(atuple[:0] + atuple[0 + 1:]))[1], (atuple[1],) + tuple(permutations(atuple[:1] + atuple[1 + 1:]))[0],  (atuple[1],) + tuple(permutations(atuple[:1] + atuple[1 + 1:]))[1], (atuple[2],) + tuple(permutations(atuple[:2] + atuple[2 + 1:]))[0], (atuple[2],) + tuple(permutations(atuple[:2] + atuple[2 + 1:]))[1]}


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