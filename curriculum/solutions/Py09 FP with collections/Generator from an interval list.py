def generator(intlist):
    aux_list = []
    list(map(lambda x: aux_list.append(list(range(x[0], x[1] + 1))), intlist))
    for element in aux_list:
        for element2 in element:
            yield element2