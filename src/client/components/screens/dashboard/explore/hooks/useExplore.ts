import {exploreAdapter} from "../adapters/explore.adapter"
import {exploreMock} from "../mock/explore.mock"

export function useExplore(){
    return exploreAdapter(exploreMock)
}
