def rearrange(l):
    return list(filter(lambda x: x<=0, l)) + list(filter(lambda x: x>0, l))

# esqueci-me que o filter existia
# def rearrange(l):
#     return [x for x in list(map(lambda x: None if (x > 0) else x, l)) if x != None] + list(map(lambda x: l[x], [x for x in list(map(lambda x: x[0] if (x[1] > 0) else None, enumerate(l))) if x!= None]))