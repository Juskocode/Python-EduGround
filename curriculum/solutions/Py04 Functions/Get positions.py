def get_positions(sentence, word_list):
    sentence += " "
    word = ""
    answer = ""
    for char in sentence:
        if char == " ":
            for i in range(len(word_list)):
                if word == word_list[i]:
                    answer += f"{i} "
                    break
            word = ""
        else:
            word += char
    if len(answer) == 4:
        return answer
    else:
        return ""