def min_path(path):
    paths = path.copy()
    previous_element = path[0]
    counter = 0
    for element in path:
        if counter == 0:
            counter += 1
            continue
        else:
            if element == "UP" and previous_element == "DOWN":
                paths.pop(counter - 1)
                paths.pop(counter - 1)
                if counter >= 2:
                    previous_element = paths[counter - 2]
                else:
                    previous_element = ""
                counter -= 1
                continue
            elif element == "DOWN" and previous_element == "UP":
                paths.pop(counter - 1)
                paths.pop(counter - 1)
                if counter >= 2:
                    previous_element = paths[counter - 2]
                else:
                    previous_element = ""
                counter -= 1
                continue
            elif element == "RIGHT" and previous_element == "LEFT":
                paths.pop(counter - 1)
                paths.pop(counter - 1)
                if counter >= 2:
                    previous_element = paths[counter - 2]
                else:
                    previous_element = ""
                counter -= 1
                continue
            elif element == "LEFT" and previous_element == "RIGHT":
                paths.pop(counter - 1)
                paths.pop(counter - 1)
                if counter >= 2:
                    previous_element = paths[counter - 2]
                else:
                    previous_element = ""
                counter -= 1
                continue
        previous_element = element
        counter += 1
    return paths