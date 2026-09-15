package jsontree_test

import (
	"reflect"
	"testing"

	"github.com/helmedeiros/quartermark/jsontree"
)

func TestWalk_VisitsEveryNodeDepthFirstIncludingNestedChildren(t *testing.T) {
	tree := []any{
		map[string]any{
			"id": "A",
			"children": []any{
				map[string]any{"id": "A-1"},
				map[string]any{"id": "A-2", "children": []any{
					map[string]any{"id": "A-2-1"},
				}},
			},
		},
		map[string]any{"id": "B"},
	}

	var visited []string
	jsontree.Walk(tree, func(node map[string]any) {
		visited = append(visited, node["id"].(string))
	})

	want := []string{"A", "A-1", "A-2", "A-2-1", "B"}
	if !reflect.DeepEqual(visited, want) {
		t.Fatalf("Walk visited %v, want %v", visited, want)
	}
}

func TestWalk_NonSliceRootVisitsNothing(t *testing.T) {
	var visited int
	jsontree.Walk("not a slice", func(map[string]any) { visited++ })
	jsontree.Walk(nil, func(map[string]any) { visited++ })
	if visited != 0 {
		t.Fatalf("expected no visits for a non-slice root, got %d", visited)
	}
}

func TestWalk_SkipsNonMapEntries(t *testing.T) {
	tree := []any{"not a map", map[string]any{"id": "A"}, 42}
	var visited []string
	jsontree.Walk(tree, func(node map[string]any) {
		visited = append(visited, node["id"].(string))
	})
	if !reflect.DeepEqual(visited, []string{"A"}) {
		t.Fatalf("expected only the map entry to be visited, got %v", visited)
	}
}

func TestStringSlice_FiltersNonStringsAndEmptyStrings(t *testing.T) {
	got := jsontree.StringSlice([]any{"a", "", 1, "b", nil})
	want := []string{"a", "b"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("StringSlice = %v, want %v", got, want)
	}
}

func TestStringSlice_NonSliceReturnsNil(t *testing.T) {
	if got := jsontree.StringSlice("not a slice"); got != nil {
		t.Fatalf("expected nil, got %v", got)
	}
}
