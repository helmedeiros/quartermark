package jsontree

func Walk(nodesAny any, visit func(node map[string]any)) {
	nodes, ok := nodesAny.([]any)
	if !ok {
		return
	}
	for _, nAny := range nodes {
		node, ok := nAny.(map[string]any)
		if !ok {
			continue
		}
		visit(node)
		Walk(node["children"], visit)
	}
}

func StringSlice(v any) []string {
	items, ok := v.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if s, ok := item.(string); ok && s != "" {
			out = append(out, s)
		}
	}
	return out
}
