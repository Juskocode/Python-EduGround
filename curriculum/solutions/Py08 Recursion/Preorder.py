# eu aqui fui nabo porque pronto não aproveitei o facto de ser uma árvore binária
def preorder(tree):
    if len(tree) == 1:
        if type(tree[0]) is tuple:
            return preorder(tree[0])
        if tree[0] == None:
            return []
        return [tree[0]]
    if type(tree[0]) is tuple:
        return preorder(tree[0]) + preorder(tree[1:])
    if tree[0] == None:
        return preorder(tree[1:])
    return [tree[0]] + preorder(tree[1:])