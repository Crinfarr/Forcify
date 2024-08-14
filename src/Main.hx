package ;

import haxe.io.Bytes;
import sys.io.File;
import haxe.Json;
import sys.thread.Thread;
import sys.thread.Lock;
import sys.thread.Deque;
import sys.thread.Semaphore;
import sys.thread.FixedThreadPool;
import sys.Http;

using StringTools;

class Main {
	static function main() {
        #if nothreads
		// final ofile = File.append("found.list", false);
        final l = new Lock();
        var n = 0;
        var pf = [0, 0];
        while (true) {
			final h = new Http('https://gyazo.com/${[for (_ in 0...16) Math.round(Math.random()*255).hex(2).toLowerCase()].join('')}');
            h.onStatus = (s) -> {
                if (s == 200) {
                    pf[1]++;
                    Sys.println('Found #${++n} - ${h.url}');
					// ofile.writeString(Json.parse(h.responseData).url + '\n');
                } else {
                    pf[0]++;
                }
                l.release();
            }
			Sys.print('[❌${pf[0]} - ✅${pf[1]}]\t${h.url}\r');
            h.request();
            l.wait();
        }
        #else
		final maxthreads = Std.parseInt(if (Sys.args().contains('-mt')) Sys.args()[Sys.args().indexOf('-mt') + 1] else "4");
		final outdir = if (Sys.args().contains('-o')) Sys.args()[Sys.args().indexOf('-o') + 1] else "./";

		var statemap = [for (_ in 0...maxthreads) "❌"];
		final d:Deque<String> = new Deque<String>();
		var ds:Int = 0;
		var found:Int = 0;
		final threadpool = new FixedThreadPool(maxthreads);
        final htpl = new Lock();
		for (i in 0...maxthreads) {
			threadpool.run(() -> {
				final thisIdx = i;
				while (true) {
					final h = new Http('https://api.gyazo.com/api/oembed?url=https://gyazo.com/${d.pop(true)}');
					ds--;
					h.onStatus = (statusCode) -> {
						if (statusCode == 404)
							statemap[thisIdx] = "❌";
						else if (statusCode == 200) {
							statemap[thisIdx] = "✅";
							final realUrl:String = Json.parse(h.responseData).url;
							final h2 = new Http(realUrl);
							final filereg = ~/(?<=\/).+\..+$/gm;
							filereg.match(realUrl);

							final oF = File.append('$outdir${filereg.matched(0)}');
							h2.onBytes = (b) -> {
								oF.write(b);
							}
                            htpl.wait();
							h2.request();
                            htpl.release();
						}
					};

					htpl.wait();
                    h.request();
					statemap[thisIdx] = "❓";
                    htpl.release();
				}
			});
		}
        htpl.release();
		while (true) {
			if (ds <= maxthreads * 2) {
				final byt = [for (_ in 0...16) Math.round(Math.random() * 255).hex(2)].join('');
				d.add(byt);
				ds++;
			}
			Sys.print('[${statemap.join("|")}] - $ds queued, $found found\r');
		}
        #end
	}
}
