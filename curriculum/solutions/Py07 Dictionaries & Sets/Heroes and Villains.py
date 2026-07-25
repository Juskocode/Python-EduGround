def fight(heroes, villain):
    villain["health"] = round(villain["health"], 1)
    for hero in heroes:
        if hero["category"] == villain["category"]:
            if hero["health"] >= villain["health"]:
                return f'{hero["name"]} defeated the villain and now has a score of {hero["score"] + 1}'
            else:
                villain["health"] = round(villain["health"] - hero["health"]/2, 1)
    return f'{villain["name"]} prevailed with {villain["health"]}HP left'