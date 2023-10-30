export const streamToObject = <T>(stream: NodeJS.ReadableStream): Promise<T> => {
  return new Promise((res, rej) => {
    const bufs = [];

    stream.on('data', function (d) {
      bufs.push(d);
    });

    stream.on('error', function (e) {
      rej(e);
    });

    stream.on('end', function () {
      const buf = Buffer.concat(bufs);
      res(JSON.parse(buf.toString()));
    });
  });
};
