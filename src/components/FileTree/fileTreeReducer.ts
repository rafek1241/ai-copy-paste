import type { FileTreeAction, FileTreeState } from "./fileTreeTypes";

export const initialFileTreeState: FileTreeState = {
  nodesMap: {},
  rootPaths: [],
  filterType: "ALL",
  isLoading: false,
};

export function fileTreeReducer(state: FileTreeState, action: FileTreeAction): FileTreeState {
  switch (action.type) {
    case "SET_NODES":
      return { ...state, nodesMap: action.payload.map, rootPaths: action.payload.rootPaths };
    case "UPDATE_NODE":
      return {
        ...state,
        nodesMap: { ...state.nodesMap, [action.payload.path]: action.payload },
      };
    case "UPDATE_NODES_MAP":
      return { ...state, nodesMap: action.payload };
    case "SET_FILTER":
      return { ...state, filterType: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "CLEAR_ALL":
      return initialFileTreeState;
    default:
      return state;
  }
}
