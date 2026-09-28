package quartermark_test

import (
	"os/exec"
	"strings"
	"testing"
)

const modulePath = "github.com/helmedeiros/quartermark"

var layers = map[string][]string{
	"okr":               {"okr/tracker", "shared/timewindow"},
	"okr/tracker":       {"shared/timewindow"},
	"shared/timewindow": {},
	"shared/httpx":      {},
	"app": {
		"okr", "okr/tracker", "shared/timewindow",
		"adapters/driven/okrdoc",
	},
}

func dependenciesOf(t *testing.T, pkg string) []string {
	t.Helper()
	out, err := exec.Command("go", "list", "-deps", "./"+pkg).Output()
	if err != nil {
		t.Fatalf("go list -deps ./%s: %v", pkg, err)
	}

	var own []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if !strings.HasPrefix(line, modulePath+"/") {
			continue
		}
		name := strings.TrimPrefix(line, modulePath+"/")
		if name != pkg {
			own = append(own, name)
		}
	}
	return own
}

func TestEachLayerDependsOnlyOnWhatItIsAllowedTo(t *testing.T) {
	for pkg, allowed := range layers {
		t.Run(pkg, func(t *testing.T) {
			permitted := map[string]bool{}
			for _, a := range allowed {
				permitted[a] = true
			}

			for _, dep := range dependenciesOf(t, pkg) {
				if !permitted[dep] {
					t.Errorf("%s imports %s, which is not in its allowed set %v", pkg, dep, allowed)
				}
			}
		})
	}
}

func TestTheDomainReachesNoAdapter(t *testing.T) {
	for _, pkg := range []string{"okr", "okr/tracker", "shared/timewindow"} {
		for _, dep := range dependenciesOf(t, pkg) {
			if strings.HasPrefix(dep, "adapters/") || strings.HasPrefix(dep, "cmd/") {
				t.Errorf("%s reaches outward to %s", pkg, dep)
			}
		}
	}
}

func TestTheApplicationReachesNoTransport(t *testing.T) {
	for _, dep := range dependenciesOf(t, "app") {
		if strings.HasPrefix(dep, "adapters/driving/okrapi") || strings.HasPrefix(dep, "cmd/") {
			t.Errorf("app reaches its own caller through %s", dep)
		}
	}
}

func TestNoAdapterDependsOnAnother(t *testing.T) {
	for _, adapter := range []string{"adapters/driven/sqlite", "adapters/driven/jira", "adapters/driven/connectors"} {
		for _, dep := range dependenciesOf(t, adapter) {
			if strings.HasPrefix(dep, "adapters/") && dep != "adapters/driven/okrdoc" {
				t.Errorf("%s depends on another adapter, %s", adapter, dep)
			}
		}
	}
}
