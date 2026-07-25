def treasure(clues):
    clue = (0, 0)
    while clue in clues.keys():
        clue2 = clues[clue]
        del clues[clue]
        clue = clue2
    return clue