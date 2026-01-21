{
  description = "notes.junghanacs.com - Digital Garden";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs_22
            pkgs.gitleaks       # 비밀 탐지 (secretlint 대체)
          ];

          shellHook = ''
            echo "🌱 Digital Garden 개발 환경"
            echo "================================"
            echo "Node: $(node --version)"
            echo "Gitleaks: $(gitleaks version)"
            echo ""
            echo "명령어:"
            echo "  npx quartz build      # 빌드"
            echo "  ./lint.sh             # 비밀 탐지"
            echo ""
          '';
        };
      }
    );
}
