import { minimatch } from "minimatch"

export function matchesProtectedRoute(path,patterns) {
    if(!path || !Array.isArray(patterns) || patterns.length===0) {
        return false;
    }
    return patterns.some((pattern)=>minimatch(path,pattern));
}