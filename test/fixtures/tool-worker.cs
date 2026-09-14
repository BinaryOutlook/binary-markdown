// Native negative-test worker. Windows cannot execute POSIX shebang fixtures.
// This process performs the behavior itself, so cancellation leaves no child.
using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Web.Script.Serialization;

class ToolWorker {
    static int Main(string[] args) {
        string[] config = File.ReadAllLines(Process.GetCurrentProcess().MainModule.FileName + ".fixture");
        switch (config[0]) {
            case "echo":
                Console.Write(new JavaScriptSerializer().Serialize(args));
                return 0;
            case "incomplete-pandoc":
                string argument = args.Length == 0 ? "" : args[0];
                Console.Write(argument == "--version" ? "pandoc 3.8.3\n" : argument == "--list-input-formats" ? "commonmark_x\njson\n" : "html\n");
                return 0;
            case "hang":
                if (args.Length > 0) File.WriteAllText(args[0], Process.GetCurrentProcess().Id.ToString());
                Thread.Sleep(Timeout.Infinite);
                return 0;
            case "fail-pandoc":
                File.WriteAllText(config[1], Environment.CurrentDirectory);
                Console.Error.Write("Controlled converter failure");
                return 4;
            case "controlled-pandoc":
            case "controlled-pandoc-fail":
                string option = args.Length == 0 ? "" : args[0];
                if (option == "--version") Console.WriteLine("pandoc 3.8.3");
                else if (option == "--list-input-formats") Console.WriteLine("commonmark_x\njson");
                else if (option == "--list-output-formats") Console.WriteLine("json\ndocx\nepub");
                else if (option == "--list-extensions=commonmark_x") Console.WriteLine("+tex_math_gfm");
                else {
                    File.WriteAllText(config[1], Process.GetCurrentProcess().Id.ToString());
                    if (config[0] == "controlled-pandoc-fail") {
                        Console.Error.Write("CONTROLLED-WRITER-FAILURE");
                        return 2;
                    }
                    Thread.Sleep(Timeout.Infinite);
                }
                return 0;
            case "ast-pandoc":
                string input = Console.In.ReadToEnd();
                if (Array.IndexOf(args, "--to=json") >= 0) Console.Write(config[2]);
                else {
                    var serializer = new JavaScriptSerializer();
                    File.WriteAllText(config[1], serializer.Serialize(new { args = args, ast = serializer.DeserializeObject(input) }));
                    string output = Array.Find(args, arg => arg.StartsWith("--output="));
                    File.WriteAllBytes(output.Substring(9), new byte[] { 80, 75, 3, 4 });
                }
                return 0;
            default:
                return 2;
        }
    }
}
