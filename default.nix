{
  system ? builtins.currentSystem,
  overlays ? [],
  nixpkgs ? fetchTarball {
    url = https://github.com/NixOS/nixpkgs/archive/c5c6009fb436efe5732e07cd0e5692f495321752.tar.gz;
    sha256 = "17h1dyi4alc3d7r6ivz9r76a3f7cxdwxw2kc3akhpgf5b00pnzv2";
  }
}:
let
  pkgs = import nixpkgs {
    inherit system overlays;
  };
in
{
  shell = pkgs.mkShell {
    nativeBuildInputs = with pkgs; [ nodejs-14_x ];
    shellHook = ''
      export PATH=$PATH:$PWD/node_modules/.bin
    '';
  };
}
