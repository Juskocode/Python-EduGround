def bagdiff(xs, ys):
    for counter, element_to_eliminate in enumerate(ys):
        if element_to_eliminate in xs:
            xs.pop(xs.index(element_to_eliminate))
        ys.pop(counter)
    return xs