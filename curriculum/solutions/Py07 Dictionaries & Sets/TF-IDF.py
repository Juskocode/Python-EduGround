from math import log

def tfidf(documents):
    dict_result = {}
    doc_number = 0
    for document in documents:
        list_of_words = (document.lower()).split(' ')
        for word in list_of_words:
            if word in dict_result.keys():
                dict_result[word][doc_number] += 1
            else:
                dict_result[word] = []
                for i in range(len(documents)):
                    dict_result[word].append(0.0)
                dict_result[word][doc_number] += 1
        doc_number += 1
    dict_result_keys = dict_result.keys()
    for word in dict_result_keys:
        number_of_docs_where_word_appears = 0
        for number_appears_in_a_doc in dict_result[word]:
            if number_appears_in_a_doc > 0:
                number_of_docs_where_word_appears += 1
        for i in range(doc_number):
            dict_result[word][i] = round(dict_result[word][i] * log(doc_number/number_of_docs_where_word_appears), 3)
    return dict_result